-- Tests for MPW.Player and MPW.Group models
-- Run with: busted addon/tests/

-- Minimal stubs for WoW APIs and libraries
_G.LibStub = function(name)
    local addon = { NewAddon = function() return {} end }
    addon.GetAddon = function() return addon end
    return addon
end

-- Load source files in order
dofile("addon/src/Config.lua")
dofile("addon/src/Models.lua")

local Player = MythicPlusWheel.Player
local Group = MythicPlusWheel.Group

describe("Player", function()
    describe(":New()", function()
        it("should create a player with a main role", function()
            local p = Player:New("TestTank", "tank", {}, {})
            assert.equal("TestTank", p.name)
            assert.equal("tank", p.mainRole)
            assert.is_true(p:IsTankMain())
            assert.is_false(p:IsHealerMain())
        end)

        it("should create a player with offspecs", function()
            local p = Player:New("Hybrid", "melee", {"tank", "healer"}, {})
            assert.is_true(p:IsMelee())
            assert.is_true(p:IsOfftank())
            assert.is_true(p:IsOffhealer())
            assert.is_false(p:IsOffranged())
        end)

        it("should create a player with utilities", function()
            local p = Player:New("DK", "melee", {}, {"brez"})
            assert.is_true(p:HasBrez())
            assert.is_false(p:HasLust())
        end)

        it("should default offspecs and utilities to empty", function()
            local p = Player:New("Simple", "ranged")
            assert.same({}, p.offspecs)
            assert.same({}, p.utilities)
        end)
    end)

    describe(":IsDpsMain()", function()
        it("should return true for ranged", function()
            local p = Player:New("Mage", "ranged")
            assert.is_true(p:IsDpsMain())
        end)

        it("should return true for melee", function()
            local p = Player:New("Rogue", "melee")
            assert.is_true(p:IsDpsMain())
        end)

        it("should return false for tank", function()
            local p = Player:New("Tank", "tank")
            assert.is_false(p:IsDpsMain())
        end)
    end)

    describe(":IsOffdps()", function()
        it("should return true if offspec contains ranged or melee", function()
            local p = Player:New("Flex", "tank", {"ranged"}, {})
            assert.is_true(p:IsOffdps())
        end)
    end)

    describe(":Equals()", function()
        it("should compare by name", function()
            local a = Player:New("Alice", "tank")
            local b = Player:New("Alice", "healer")
            assert.is_true(a:Equals(b))
        end)

        it("should return false for different names", function()
            local a = Player:New("Alice", "tank")
            local b = Player:New("Bob", "tank")
            assert.is_false(a:Equals(b))
        end)
    end)

    describe(":HasRoles()", function()
        it("should return true when mainRole is set", function()
            local p = Player:New("Tank", "tank")
            assert.is_true(p:HasRoles())
        end)

        it("should return true when offspecs exist", function()
            local p = Player:New("Flex", nil, {"tank"})
            assert.is_true(p:HasRoles())
        end)

        it("should return false when no roles", function()
            local p = Player:New("Empty", nil, {}, {})
            assert.is_false(p:HasRoles())
        end)
    end)

    describe("serialization", function()
        it("should round-trip through ToDict/FromDict", function()
            local original = Player:New("Test", "healer", {"ranged"}, {"brez", "lust"})
            local dict = original:ToDict()
            local restored = Player.FromDict(dict)

            assert.equal(original.name, restored.name)
            assert.equal(original.mainRole, restored.mainRole)
            assert.same(original.offspecs, restored.offspecs)
            assert.same(original.utilities, restored.utilities)
        end)
    end)
end)

describe("Group", function()
    local tank, healer, dps1, dps2, dps3

    before_each(function()
        tank = Player:New("Tank", "tank", {}, {"brez"})
        healer = Player:New("Healer", "healer", {}, {})
        dps1 = Player:New("Mage", "ranged", {}, {"lust"})
        dps2 = Player:New("Rogue", "melee", {}, {})
        dps3 = Player:New("Hunter", "ranged", {}, {"lust"})
    end)

    describe(":New()", function()
        it("should create an empty group", function()
            local g = Group:New()
            assert.is_nil(g.tank)
            assert.is_nil(g.healer)
            assert.same({}, g.dps)
        end)
    end)

    describe(":IsComplete()", function()
        it("should return true for a full 5-man group", function()
            local g = Group:New(tank, healer, {dps1, dps2, dps3})
            assert.is_true(g:IsComplete())
        end)

        it("should return false when missing players", function()
            local g = Group:New(tank, healer, {dps1})
            assert.is_false(g:IsComplete())
        end)
    end)

    describe(":GetSize()", function()
        it("should count all players", function()
            local g = Group:New(tank, healer, {dps1, dps2})
            assert.equal(4, g:GetSize())
        end)
    end)

    describe(":HasBrez()", function()
        it("should return true when any player has brez", function()
            local g = Group:New(tank, healer, {})
            assert.is_true(g:HasBrez())
        end)

        it("should return false when no player has brez", function()
            local g = Group:New(nil, healer, {dps2})
            assert.is_false(g:HasBrez())
        end)
    end)

    describe(":HasLust()", function()
        it("should return true when any player has lust", function()
            local g = Group:New(nil, nil, {dps1})
            assert.is_true(g:HasLust())
        end)
    end)

    describe(":HasRanged()", function()
        it("should detect ranged players", function()
            local g = Group:New(tank, healer, {dps1})
            assert.is_true(g:HasRanged())
        end)

        it("should return false with only melee", function()
            local g = Group:New(tank, healer, {dps2})
            assert.is_false(g:HasRanged())
        end)
    end)

    describe("serialization", function()
        it("should round-trip through ToDict/FromDict", function()
            local original = Group:New(tank, healer, {dps1, dps2, dps3})
            local dict = original:ToDict()
            local restored = Group.FromDict(dict)

            assert.equal(original.tank.name, restored.tank.name)
            assert.equal(original.healer.name, restored.healer.name)
            assert.equal(#original.dps, #restored.dps)
            for i = 1, #original.dps do
                assert.equal(original.dps[i].name, restored.dps[i].name)
            end
        end)
    end)
end)
