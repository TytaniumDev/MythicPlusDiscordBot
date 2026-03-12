-- Tests for GuildService with mocked WoW APIs
-- Run with: busted addon/tests/

-- Minimal stubs for WoW APIs and libraries
_G.LibStub = function()
    local addon = {}
    addon.NewAddon = function(_, name, ...)
        addon.name = name
        addon.Print = function() end
        addon.RegisterComm = function() end
        addon.RegisterEvent = function() end
        addon.UnregisterAllEvents = function() end
        addon.Serialize = function(_, data) return "serialized" end
        addon.Deserialize = function(_, data) return true, data end
        addon.SendCommMessage = function() end
        return addon
    end
    addon.New = function(_, name, defaults) return { profile = defaults and defaults.profile or {} } end
    return addon
end

-- WoW API mocks (overridden per test)
_G.GetNumGuildMembers = function() return 0 end
_G.GetGuildRosterInfo = function() return nil end
_G.IsInGuild = function() return true end
_G.GetGuildInfo = function() return "Test Guild" end

-- Load source files in order
dofile("src/Config.lua")
dofile("src/Models.lua")
dofile("src/Services/SpecService.lua") -- needed for StripRealmName
dofile("src/Services/GuildService.lua")

local MPW = MythicPlusWheel

describe("GuildService", function()
    before_each(function()
        _G.GetNumGuildMembers = function() return 0 end
        _G.GetGuildRosterInfo = function() return nil end
        _G.IsInGuild = function() return true end
        _G.GetGuildInfo = function() return "Test Guild" end
    end)

    describe(":GetOnlineGuildMembers()", function()
        it("should return empty array when no guild members", function()
            _G.GetNumGuildMembers = function() return 0 end
            local result = MPW:GetOnlineGuildMembers()
            assert.same({}, result)
        end)

        it("should return online max-level members", function()
            _G.GetNumGuildMembers = function() return 3 end
            _G.GetGuildRosterInfo = function(index)
                local members = {
                    [1] = { "Tank", nil, nil, 90, nil, nil, nil, nil, true, nil, "WARRIOR" },
                    [2] = { "Healer", nil, nil, 90, nil, nil, nil, nil, true, nil, "PRIEST" },
                    [3] = { "LowLevel", nil, nil, 50, nil, nil, nil, nil, true, nil, "MAGE" },
                }
                local m = members[index]
                if m then
                    return m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11]
                end
            end

            local result = MPW:GetOnlineGuildMembers()
            assert.equal(2, #result)
            assert.equal("Tank", result[1].name)
            assert.equal("WARRIOR", result[1].classToken)
            assert.equal("Healer", result[2].name)
            assert.equal("PRIEST", result[2].classToken)
        end)

        it("should filter out offline members", function()
            _G.GetNumGuildMembers = function() return 2 end
            _G.GetGuildRosterInfo = function(index)
                local members = {
                    [1] = { "Online", nil, nil, 90, nil, nil, nil, nil, true, nil, "WARRIOR" },
                    [2] = { "Offline", nil, nil, 90, nil, nil, nil, nil, false, nil, "MAGE" },
                }
                local m = members[index]
                if m then
                    return m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11]
                end
            end

            local result = MPW:GetOnlineGuildMembers()
            assert.equal(1, #result)
            assert.equal("Online", result[1].name)
        end)

        it("should strip realm names from cross-realm members", function()
            _G.GetNumGuildMembers = function() return 1 end
            _G.GetGuildRosterInfo = function(index)
                if index == 1 then
                    return "CrossRealm-Stormrage", nil, nil, 90, nil, nil, nil, nil, true, nil, "PALADIN"
                end
            end

            local result = MPW:GetOnlineGuildMembers()
            assert.equal(1, #result)
            assert.equal("CrossRealm", result[1].name)
        end)

        it("should handle large guild roster", function()
            local memberCount = 50
            _G.GetNumGuildMembers = function() return memberCount end
            _G.GetGuildRosterInfo = function(index)
                if index <= memberCount then
                    local online = (index % 2 == 1)
                    local level = (index <= 40) and 90 or 80
                    return "Player" .. index, nil, nil, level, nil, nil, nil, nil, online, nil, "WARRIOR"
                end
            end

            local result = MPW:GetOnlineGuildMembers()
            -- Only online (odd indices) and max level (indices 1-40) qualify
            -- Odd indices from 1-40: 1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35,37,39 = 20
            assert.equal(20, #result)
        end)

        it("should handle nil level gracefully", function()
            _G.GetNumGuildMembers = function() return 1 end
            _G.GetGuildRosterInfo = function(index)
                if index == 1 then
                    return "NoLevel", nil, nil, nil, nil, nil, nil, nil, true, nil, "WARRIOR"
                end
            end

            local result = MPW:GetOnlineGuildMembers()
            assert.equal(0, #result) -- nil level should be filtered out
        end)
    end)

    describe(":GetGuildName()", function()
        it("should return guild name when in a guild", function()
            _G.IsInGuild = function() return true end
            _G.GetGuildInfo = function() return "Awesome Guild" end

            local result = MPW:GetGuildName()
            assert.equal("Awesome Guild", result)
        end)

        it("should return nil when not in a guild", function()
            _G.IsInGuild = function() return false end

            local result = MPW:GetGuildName()
            assert.is_nil(result)
        end)
    end)

    describe(":IsGuildMember()", function()
        it("should return true for a guild member", function()
            _G.GetNumGuildMembers = function() return 3 end
            _G.GetGuildRosterInfo = function(index)
                local names = { "Alice", "Bob", "Charlie" }
                return names[index]
            end

            assert.is_true(MPW:IsGuildMember("Bob"))
        end)

        it("should return false for a non-member", function()
            _G.GetNumGuildMembers = function() return 3 end
            _G.GetGuildRosterInfo = function(index)
                local names = { "Alice", "Bob", "Charlie" }
                return names[index]
            end

            assert.is_false(MPW:IsGuildMember("Dave"))
        end)

        it("should match cross-realm names by stripping realm", function()
            _G.GetNumGuildMembers = function() return 1 end
            _G.GetGuildRosterInfo = function(index)
                if index == 1 then return "Alice-Stormrage" end
            end

            assert.is_true(MPW:IsGuildMember("Alice"))
        end)

        it("should return false when roster is empty", function()
            _G.GetNumGuildMembers = function() return 0 end

            assert.is_false(MPW:IsGuildMember("Anyone"))
        end)

        it("should handle nil from GetGuildRosterInfo", function()
            _G.GetNumGuildMembers = function() return 2 end
            _G.GetGuildRosterInfo = function(index)
                if index == 1 then return nil end
                if index == 2 then return "ValidPlayer" end
            end

            assert.is_false(MPW:IsGuildMember("Ghost"))
            assert.is_true(MPW:IsGuildMember("ValidPlayer"))
        end)
    end)
end)
