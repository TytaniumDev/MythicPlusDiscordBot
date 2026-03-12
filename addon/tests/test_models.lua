-- Tests for MPW.Player and MPW.Group models
-- Run with: busted addon/tests/

-- Minimal stubs for WoW APIs and libraries
_G.LibStub = function()
    local addon = {}
    addon.NewAddon = function(_, name, ...)
        addon.name = name
        addon.Print = function(self, msg) end
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

-- Load source files in order
dofile("src/Config.lua")
dofile("src/Models.lua")

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

        it("should create a player with both utilities", function()
            local p = Player:New("Hybrid", "ranged", {}, {"brez", "lust"})
            assert.is_true(p:HasBrez())
            assert.is_true(p:HasLust())
        end)

        it("should create a player with nil mainRole", function()
            local p = Player:New("Unknown", nil, {}, {})
            assert.is_nil(p.mainRole)
            assert.is_false(p:IsTankMain())
            assert.is_false(p:IsHealerMain())
            assert.is_false(p:IsDpsMain())
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

        it("should return false for healer", function()
            local p = Player:New("Healer", "healer")
            assert.is_false(p:IsDpsMain())
        end)
    end)

    describe(":IsOffdps()", function()
        it("should return true if offspec contains ranged or melee", function()
            local p = Player:New("Flex", "tank", {"ranged"}, {})
            assert.is_true(p:IsOffdps())
        end)

        it("should return true for melee offspec", function()
            local p = Player:New("Flex", "healer", {"melee"}, {})
            assert.is_true(p:IsOffdps())
        end)

        it("should return false when no dps offspec", function()
            local p = Player:New("TankHealer", "tank", {"healer"}, {})
            assert.is_false(p:IsOffdps())
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

    describe(":IsRanged() and :IsMelee()", function()
        it("should identify ranged players", function()
            local p = Player:New("Mage", "ranged")
            assert.is_true(p:IsRanged())
            assert.is_false(p:IsMelee())
        end)

        it("should identify melee players", function()
            local p = Player:New("Rogue", "melee")
            assert.is_false(p:IsRanged())
            assert.is_true(p:IsMelee())
        end)
    end)

    describe("offspec checks", function()
        it("should detect off-tank", function()
            local p = Player:New("Paladin", "healer", {"tank", "melee"}, {})
            assert.is_true(p:IsOfftank())
            assert.is_true(p:IsOffmelee())
            assert.is_false(p:IsOffranged())
        end)

        it("should detect off-ranged", function()
            local p = Player:New("Druid", "tank", {"ranged", "healer"}, {})
            assert.is_true(p:IsOffranged())
            assert.is_true(p:IsOffhealer())
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

        it("should handle nil mainRole in serialization", function()
            local original = Player:New("NoRole", nil, {}, {"brez"})
            local dict = original:ToDict()
            local restored = Player.FromDict(dict)

            assert.is_nil(restored.mainRole)
            assert.same(original.utilities, restored.utilities)
        end)

        it("should handle empty offspecs in FromDict", function()
            local dict = { name = "Test", mainRole = "tank" }
            local restored = Player.FromDict(dict)

            assert.same({}, restored.offspecs)
            assert.same({}, restored.utilities)
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

        it("should create a full group", function()
            local g = Group:New(tank, healer, {dps1, dps2, dps3})
            assert.equal("Tank", g.tank.name)
            assert.equal("Healer", g.healer.name)
            assert.equal(3, #g.dps)
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

        it("should return false with no tank", function()
            local g = Group:New(nil, healer, {dps1, dps2, dps3})
            assert.is_false(g:IsComplete())
        end)

        it("should return false with no healer", function()
            local g = Group:New(tank, nil, {dps1, dps2, dps3})
            assert.is_false(g:IsComplete())
        end)
    end)

    describe(":GetSize()", function()
        it("should count all players", function()
            local g = Group:New(tank, healer, {dps1, dps2})
            assert.equal(4, g:GetSize())
        end)

        it("should count zero for empty group", function()
            local g = Group:New()
            assert.equal(0, g:GetSize())
        end)

        it("should count only tank if others missing", function()
            local g = Group:New(tank, nil, {})
            assert.equal(1, g:GetSize())
        end)
    end)

    describe(":GetPlayers()", function()
        it("should return all players in order", function()
            local g = Group:New(tank, healer, {dps1})
            local players = g:GetPlayers()
            assert.equal(3, #players)
            assert.equal("Tank", players[1].name)
            assert.equal("Healer", players[2].name)
            assert.equal("Mage", players[3].name)
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

        it("should return false when no player has lust", function()
            local g = Group:New(tank, healer, {dps2})
            assert.is_false(g:HasLust())
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

        it("should handle empty group serialization", function()
            local original = Group:New()
            local dict = original:ToDict()
            local restored = Group.FromDict(dict)

            assert.is_nil(restored.tank)
            assert.is_nil(restored.healer)
            assert.same({}, restored.dps)
        end)

        it("should preserve player utilities through serialization", function()
            local original = Group:New(tank, healer, {dps1})
            local dict = original:ToDict()
            local restored = Group.FromDict(dict)

            assert.is_true(restored.tank:HasBrez())
            assert.is_true(restored.dps[1]:HasLust())
        end)
    end)
end)
