-- Tests for group creation algorithm
-- Run with: busted addon/tests/

-- Minimal stubs for WoW APIs and libraries
_G.wipe = function(t) for k in pairs(t) do t[k] = nil end end
_G.LibStub = function()
    local addon = { NewAddon = function() return {} end }
    addon.GetAddon = function() return addon end
    return addon
end

-- Load source files in order
dofile("addon/src/Config.lua")
dofile("addon/src/Models.lua")
dofile("addon/src/GroupCreator.lua")

local Player = MythicPlusWheel.Player
local MPW = MythicPlusWheel

describe("CreateMythicPlusGroups", function()
    before_each(function()
        MPW:ClearLastGroups()
    end)

    it("should create one group from exactly 5 players", function()
        local players = {
            Player:New("Tank1", "tank", {}, {"brez"}),
            Player:New("Healer1", "healer", {}, {}),
            Player:New("DPS1", "ranged", {}, {"lust"}),
            Player:New("DPS2", "melee", {}, {}),
            Player:New("DPS3", "ranged", {}, {}),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        assert.equal(1, #groups)
        assert.equal(5, groups[1]:GetSize())
    end)

    it("should create two groups from 10 players", function()
        local players = {
            Player:New("Tank1", "tank", {}, {"brez"}),
            Player:New("Tank2", "tank", {}, {}),
            Player:New("Healer1", "healer", {}, {}),
            Player:New("Healer2", "healer", {}, {}),
            Player:New("DPS1", "ranged", {}, {"lust"}),
            Player:New("DPS2", "melee", {}, {}),
            Player:New("DPS3", "ranged", {}, {}),
            Player:New("DPS4", "melee", {}, {"brez"}),
            Player:New("DPS5", "ranged", {}, {}),
            Player:New("DPS6", "melee", {}, {"lust"}),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        assert.equal(2, #groups)

        -- All players should be assigned
        local totalPlayers = 0
        for _, g in ipairs(groups) do
            totalPlayers = totalPlayers + g:GetSize()
        end
        assert.equal(10, totalPlayers)
    end)

    it("should assign tanks and healers to their roles", function()
        local players = {
            Player:New("Tank1", "tank", {}, {}),
            Player:New("Healer1", "healer", {}, {}),
            Player:New("DPS1", "ranged", {}, {}),
            Player:New("DPS2", "melee", {}, {}),
            Player:New("DPS3", "ranged", {}, {}),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        local group = groups[1]

        assert.is_not_nil(group.tank)
        assert.equal("Tank1", group.tank.name)
        assert.is_not_nil(group.healer)
        assert.equal("Healer1", group.healer.name)
        assert.equal(3, #group.dps)
    end)

    it("should handle remainder players", function()
        local players = {
            Player:New("Tank1", "tank", {}, {}),
            Player:New("Healer1", "healer", {}, {}),
            Player:New("DPS1", "ranged", {}, {}),
            Player:New("DPS2", "melee", {}, {}),
            Player:New("DPS3", "ranged", {}, {}),
            Player:New("DPS4", "melee", {}, {}),
            Player:New("DPS5", "ranged", {}, {}),
        }

        local groups = MPW:CreateMythicPlusGroups(players)

        -- Should have one full group and a remainder group
        local totalPlayers = 0
        for _, g in ipairs(groups) do
            totalPlayers = totalPlayers + g:GetSize()
        end
        assert.equal(7, totalPlayers)
    end)

    it("should use offspec tanks when not enough main tanks", function()
        local players = {
            Player:New("OfftankDPS", "melee", {"tank"}, {}),
            Player:New("Healer1", "healer", {}, {}),
            Player:New("DPS1", "ranged", {}, {}),
            Player:New("DPS2", "melee", {}, {}),
            Player:New("DPS3", "ranged", {}, {}),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        assert.is_not_nil(groups[1].tank)
        assert.equal("OfftankDPS", groups[1].tank.name)
    end)

    it("should try to distribute brez across groups", function()
        local players = {
            Player:New("Tank1", "tank", {}, {}),
            Player:New("Tank2", "tank", {}, {}),
            Player:New("Healer1", "healer", {}, {}),
            Player:New("Healer2", "healer", {}, {}),
            Player:New("BrezDPS1", "melee", {}, {"brez"}),
            Player:New("BrezDPS2", "melee", {}, {"brez"}),
            Player:New("DPS3", "ranged", {}, {}),
            Player:New("DPS4", "ranged", {}, {}),
            Player:New("DPS5", "melee", {}, {}),
            Player:New("DPS6", "melee", {}, {}),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        assert.equal(2, #groups)

        -- At least one group should have brez
        local brezCount = 0
        for _, g in ipairs(groups) do
            if g:HasBrez() then brezCount = brezCount + 1 end
        end
        assert.is_true(brezCount >= 1)
    end)

    it("should return empty list for fewer than 5 players", function()
        local players = {
            Player:New("Tank1", "tank", {}, {}),
            Player:New("Healer1", "healer", {}, {}),
            Player:New("DPS1", "ranged", {}, {}),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        -- With < 5 players, maxGroups = 0, so only remainder groups
        local totalPlayers = 0
        for _, g in ipairs(groups) do
            totalPlayers = totalPlayers + g:GetSize()
        end
        assert.equal(3, totalPlayers)
    end)
end)
