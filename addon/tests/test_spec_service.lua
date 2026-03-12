-- Tests for SpecService with mocked WoW APIs
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
_G.GetSpecialization = function() return nil end
_G.GetSpecializationInfo = function() return nil end
_G.GetNumSpecializations = function() return 0 end
_G.UnitName = function() return "TestPlayer" end
_G.UnitClass = function() return "Paladin", "PALADIN" end

-- Load source files in order
dofile("src/Config.lua")
dofile("src/Models.lua")
dofile("src/Services/SpecService.lua")

local MPW = MythicPlusWheel
local Player = MPW.Player

describe("SpecService", function()
    -- Reset mocks before each test
    before_each(function()
        _G.GetSpecialization = function() return nil end
        _G.GetSpecializationInfo = function() return nil end
        _G.GetNumSpecializations = function() return 0 end
        _G.UnitName = function() return "TestPlayer" end
        _G.UnitClass = function() return "Paladin", "PALADIN" end
    end)

    describe(":DetectLocalPlayer()", function()
        it("should return nil when no specialization is active", function()
            _G.GetSpecialization = function() return nil end
            local result = MPW:DetectLocalPlayer()
            assert.is_nil(result)
        end)

        it("should return nil when GetSpecializationInfo returns nil", function()
            _G.GetSpecialization = function() return 1 end
            _G.GetSpecializationInfo = function() return nil end
            local result = MPW:DetectLocalPlayer()
            assert.is_nil(result)
        end)

        it("should detect a Protection Paladin as tank with brez", function()
            _G.GetSpecialization = function() return 2 end
            _G.GetSpecializationInfo = function(index)
                local specs = { [1] = 65, [2] = 66, [3] = 70 } -- Holy, Prot, Ret
                return specs[index]
            end
            _G.GetNumSpecializations = function() return 3 end
            _G.UnitName = function() return "Tankadin" end
            _G.UnitClass = function() return "Paladin", "PALADIN" end

            local result = MPW:DetectLocalPlayer()
            assert.is_not_nil(result)
            assert.equal("Tankadin", result.name)
            assert.equal("tank", result.mainRole)
            assert.is_true(result:IsTankMain())
            assert.is_true(result:HasBrez())
        end)

        it("should detect offspecs from other specializations", function()
            -- Paladin: Holy (65)=healer, Prot (66)=tank, Ret (70)=melee
            -- If main is Prot (tank), offspecs should be healer and melee
            _G.GetSpecialization = function() return 2 end
            _G.GetSpecializationInfo = function(index)
                local specs = { [1] = 65, [2] = 66, [3] = 70 }
                return specs[index]
            end
            _G.GetNumSpecializations = function() return 3 end

            local result = MPW:DetectLocalPlayer()
            assert.is_not_nil(result)
            assert.equal("tank", result.mainRole)
            -- Should have healer and melee as offspecs
            assert.is_true(result:IsOffhealer())
            assert.is_true(result:IsOffmelee())
        end)

        it("should respect selectedOffspecs filter", function()
            -- Paladin with only healer offspec selected (not melee)
            _G.GetSpecialization = function() return 2 end
            _G.GetSpecializationInfo = function(index)
                local specs = { [1] = 65, [2] = 66, [3] = 70 }
                return specs[index]
            end
            _G.GetNumSpecializations = function() return 3 end

            local selectedOffspecs = { healer = true, melee = false }
            local result = MPW:DetectLocalPlayer(selectedOffspecs)
            assert.is_not_nil(result)
            assert.is_true(result:IsOffhealer())
            assert.is_false(result:IsOffmelee())
        end)

        it("should respect overrideRole", function()
            _G.GetSpecialization = function() return 2 end
            _G.GetSpecializationInfo = function(index)
                local specs = { [1] = 65, [2] = 66, [3] = 70 }
                return specs[index]
            end
            _G.GetNumSpecializations = function() return 3 end

            local result = MPW:DetectLocalPlayer(nil, "healer")
            assert.is_not_nil(result)
            assert.equal("healer", result.mainRole)
            assert.is_true(result:IsHealerMain())
        end)

        it("should detect a Restoration Shaman as healer with lust", function()
            _G.GetSpecialization = function() return 3 end
            _G.GetSpecializationInfo = function(index)
                local specs = { [1] = 262, [2] = 263, [3] = 264 } -- Ele, Enh, Resto
                return specs[index]
            end
            _G.GetNumSpecializations = function() return 3 end
            _G.UnitName = function() return "Healbot" end
            _G.UnitClass = function() return "Shaman", "SHAMAN" end

            local result = MPW:DetectLocalPlayer()
            assert.is_not_nil(result)
            assert.equal("healer", result.mainRole)
            assert.is_true(result:HasLust())
            assert.is_false(result:HasBrez())
        end)

        it("should detect a Shadow Priest as ranged DPS with no utilities", function()
            _G.GetSpecialization = function() return 3 end
            _G.GetSpecializationInfo = function(index)
                local specs = { [1] = 256, [2] = 257, [3] = 258 } -- Disc, Holy, Shadow
                return specs[index]
            end
            _G.GetNumSpecializations = function() return 3 end
            _G.UnitName = function() return "Shadowfiend" end
            _G.UnitClass = function() return "Priest", "PRIEST" end

            local result = MPW:DetectLocalPlayer()
            assert.is_not_nil(result)
            assert.equal("ranged", result.mainRole)
            assert.is_true(result:IsDpsMain())
            assert.is_false(result:HasBrez())
            assert.is_false(result:HasLust())
            -- Offspecs should include healer (from Disc and Holy, but deduplicated)
            assert.is_true(result:IsOffhealer())
        end)

        it("should detect a Blood DK as tank with brez and melee offspecs", function()
            _G.GetSpecialization = function() return 1 end
            _G.GetSpecializationInfo = function(index)
                local specs = { [1] = 250, [2] = 251, [3] = 252 } -- Blood, Frost, Unholy
                return specs[index]
            end
            _G.GetNumSpecializations = function() return 3 end
            _G.UnitName = function() return "Boneshield" end
            _G.UnitClass = function() return "Death Knight", "DEATHKNIGHT" end

            local result = MPW:DetectLocalPlayer()
            assert.is_not_nil(result)
            assert.equal("tank", result.mainRole)
            assert.is_true(result:HasBrez())
            assert.is_false(result:HasLust())
            assert.is_true(result:IsOffmelee())
        end)

        it("should handle UnitName returning nil", function()
            _G.UnitName = function() return nil end
            local result = MPW:DetectLocalPlayer()
            assert.is_nil(result)
        end)

        it("should handle unknown spec IDs gracefully", function()
            _G.GetSpecialization = function() return 1 end
            _G.GetSpecializationInfo = function() return 99999 end -- Unknown spec
            _G.GetNumSpecializations = function() return 1 end

            local result = MPW:DetectLocalPlayer()
            assert.is_nil(result) -- No role mapping for unknown spec
        end)

        it("should not duplicate offspec roles", function()
            -- Priest: Disc (256)=healer, Holy (257)=healer, Shadow (258)=ranged
            -- When main is Shadow, offspecs should be just "healer" (not "healer, healer")
            _G.GetSpecialization = function() return 3 end
            _G.GetSpecializationInfo = function(index)
                local specs = { [1] = 256, [2] = 257, [3] = 258 }
                return specs[index]
            end
            _G.GetNumSpecializations = function() return 3 end

            local result = MPW:DetectLocalPlayer()
            assert.is_not_nil(result)
            -- Count healer offspecs - should only appear once
            local healerCount = 0
            for _, os in ipairs(result.offspecs) do
                if os == "healer" then healerCount = healerCount + 1 end
            end
            assert.equal(1, healerCount)
        end)
    end)

    describe(":DetectAllOffspecs()", function()
        it("should return empty when no specialization is active", function()
            _G.GetSpecialization = function() return nil end
            local result = MPW:DetectAllOffspecs()
            assert.same({}, result)
        end)

        it("should return offspec roles for a Paladin (tank main)", function()
            _G.GetSpecialization = function() return 2 end
            _G.GetSpecializationInfo = function(index)
                local specs = { [1] = 65, [2] = 66, [3] = 70 }
                return specs[index]
            end
            _G.GetNumSpecializations = function() return 3 end

            local result = MPW:DetectAllOffspecs()
            -- Prot Paladin offspecs: healer (Holy) and melee (Ret)
            assert.equal(2, #result)
            local hasHealer, hasMelee = false, false
            for _, r in ipairs(result) do
                if r == "healer" then hasHealer = true end
                if r == "melee" then hasMelee = true end
            end
            assert.is_true(hasHealer)
            assert.is_true(hasMelee)
        end)

        it("should return empty for pure DPS class (Rogue)", function()
            -- Rogue: all 3 specs are melee
            _G.GetSpecialization = function() return 1 end
            _G.GetSpecializationInfo = function(index)
                local specs = { [1] = 259, [2] = 260, [3] = 261 }
                return specs[index]
            end
            _G.GetNumSpecializations = function() return 3 end

            local result = MPW:DetectAllOffspecs()
            -- All specs are melee, so no different offspec roles
            assert.same({}, result)
        end)

        it("should return empty for pure DPS class (Mage)", function()
            -- Mage: all 3 specs are ranged
            _G.GetSpecialization = function() return 1 end
            _G.GetSpecializationInfo = function(index)
                local specs = { [1] = 62, [2] = 63, [3] = 64 }
                return specs[index]
            end
            _G.GetNumSpecializations = function() return 3 end

            local result = MPW:DetectAllOffspecs()
            assert.same({}, result)
        end)

        it("should handle Druid with 4 specs", function()
            -- Druid: Balance (102)=ranged, Feral (103)=melee, Guardian (104)=tank, Resto (105)=healer
            _G.GetSpecialization = function() return 3 end -- Guardian (tank)
            _G.GetSpecializationInfo = function(index)
                local specs = { [1] = 102, [2] = 103, [3] = 104, [4] = 105 }
                return specs[index]
            end
            _G.GetNumSpecializations = function() return 4 end

            local result = MPW:DetectAllOffspecs()
            -- Guardian Druid offspecs: ranged, melee, healer
            assert.equal(3, #result)
        end)
    end)

    describe(":StripRealmName()", function()
        it("should strip realm name from hyphenated names", function()
            assert.equal("Player", MPW:StripRealmName("Player-Stormrage"))
        end)

        it("should handle names without realm", function()
            assert.equal("Player", MPW:StripRealmName("Player"))
        end)

        it("should handle nil input", function()
            assert.is_nil(MPW:StripRealmName(nil))
        end)

        it("should handle names with multiple hyphens", function()
            assert.equal("Player", MPW:StripRealmName("Player-Area-52"))
        end)
    end)

    describe(":DetectGuildMember()", function()
        it("should create a player with no mainRole and correct utilities", function()
            local result = MPW:DetectGuildMember("GuildTank-Stormrage", "DEATHKNIGHT")
            assert.equal("GuildTank", result.name)
            assert.is_nil(result.mainRole)
            assert.is_true(result:HasBrez())
            assert.is_false(result:HasLust())
        end)

        it("should detect lust for Shaman", function()
            local result = MPW:DetectGuildMember("ShamanDude", "SHAMAN")
            assert.equal("ShamanDude", result.name)
            assert.is_true(result:HasLust())
            assert.is_false(result:HasBrez())
        end)

        it("should detect no utilities for Rogue", function()
            local result = MPW:DetectGuildMember("Stabby", "ROGUE")
            assert.equal("Stabby", result.name)
            assert.is_false(result:HasBrez())
            assert.is_false(result:HasLust())
        end)

        it("should detect both utilities for Druid", function()
            -- Druid has brez but not lust
            local result = MPW:DetectGuildMember("TreeHugger", "DRUID")
            assert.equal("TreeHugger", result.name)
            assert.is_true(result:HasBrez())
            assert.is_false(result:HasLust())
        end)
    end)
end)
