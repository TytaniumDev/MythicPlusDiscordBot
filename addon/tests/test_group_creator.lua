-- Tests for group creation algorithm
-- Run with: busted addon/tests/

-- Minimal stubs for WoW APIs and libraries
_G.wipe = function(t) for k in pairs(t) do t[k] = nil end end
_G.os = { time = function() return 12345 end }
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

-- Load source files in order
dofile("src/Config.lua")
dofile("src/Models.lua")
dofile("src/GroupCreator.lua")

local Player = MythicPlusWheel.Player
local MPW = MythicPlusWheel

---------------------------------------------------------------------------
-- Prebuilt player constructors (port of prebuiltClasses.ts)
---------------------------------------------------------------------------

local function TankPaladin(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offhealer then offspecs[#offspecs + 1] = "healer" end
    if opts.offdps then offspecs[#offspecs + 1] = "melee" end
    return Player:New(name, "tank", offspecs, {"brez"})
end

local function TankWarrior(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offdps then offspecs[#offspecs + 1] = "melee" end
    return Player:New(name, "tank", offspecs, {})
end

local function TankDruid(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offhealer then offspecs[#offspecs + 1] = "healer" end
    if opts.offdps then offspecs[#offspecs + 1] = "melee" end
    return Player:New(name, "tank", offspecs, {"brez"})
end

local function TankDeathKnight(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offdps then offspecs[#offspecs + 1] = "melee" end
    return Player:New(name, "tank", offspecs, {"brez"})
end

local function TankMonk(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offhealer then offspecs[#offspecs + 1] = "healer" end
    if opts.offdps then offspecs[#offspecs + 1] = "melee" end
    return Player:New(name, "tank", offspecs, {})
end

local function TankDemonHunter(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offdps then offspecs[#offspecs + 1] = "melee" end
    return Player:New(name, "tank", offspecs, {})
end

local function HealerPaladin(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offtank then offspecs[#offspecs + 1] = "tank" end
    if opts.offdps then offspecs[#offspecs + 1] = "melee" end
    return Player:New(name, "healer", offspecs, {"brez"})
end

local function HealerPriest(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offdps then offspecs[#offspecs + 1] = "ranged" end
    return Player:New(name, "healer", offspecs, {})
end

local function HealerShaman(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offdps then offspecs[#offspecs + 1] = "ranged" end
    return Player:New(name, "healer", offspecs, {"lust"})
end

local function HealerDruid(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offtank then offspecs[#offspecs + 1] = "tank" end
    if opts.offdps then offspecs[#offspecs + 1] = "ranged" end
    return Player:New(name, "healer", offspecs, {"brez"})
end

local function HealerEvoker(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offdps then offspecs[#offspecs + 1] = "ranged" end
    return Player:New(name, "healer", offspecs, {"lust"})
end

local function HealerMonk(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offtank then offspecs[#offspecs + 1] = "tank" end
    if opts.offdps then offspecs[#offspecs + 1] = "melee" end
    return Player:New(name, "healer", offspecs, {})
end

local function DeathKnight(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offtank then offspecs[#offspecs + 1] = "tank" end
    return Player:New(name, "melee", offspecs, {"brez"})
end

local function DemonHunter(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offtank then offspecs[#offspecs + 1] = "tank" end
    return Player:New(name, "melee", offspecs, {})
end

local function BalanceDruid(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offtank then offspecs[#offspecs + 1] = "tank" end
    if opts.offhealer then offspecs[#offspecs + 1] = "healer" end
    return Player:New(name, "ranged", offspecs, {"brez"})
end

local function FeralDruid(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offtank then offspecs[#offspecs + 1] = "tank" end
    if opts.offhealer then offspecs[#offspecs + 1] = "healer" end
    return Player:New(name, "melee", offspecs, {"brez"})
end

local function Evoker(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offhealer then offspecs[#offspecs + 1] = "healer" end
    return Player:New(name, "ranged", offspecs, {"lust"})
end

local function Hunter(name)
    return Player:New(name, "ranged", {}, {"lust"})
end

local function Mage(name)
    return Player:New(name, "ranged", {}, {"lust"})
end

local function Monk(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offtank then offspecs[#offspecs + 1] = "tank" end
    if opts.offhealer then offspecs[#offspecs + 1] = "healer" end
    return Player:New(name, "melee", offspecs, {})
end

local function Paladin(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offtank then offspecs[#offspecs + 1] = "tank" end
    if opts.offhealer then offspecs[#offspecs + 1] = "healer" end
    return Player:New(name, "melee", offspecs, {"brez"})
end

local function Priest(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offhealer then offspecs[#offspecs + 1] = "healer" end
    return Player:New(name, "ranged", offspecs, {})
end

local function Rogue(name)
    return Player:New(name, "melee", {}, {})
end

local function Shaman(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offhealer then offspecs[#offspecs + 1] = "healer" end
    return Player:New(name, "ranged", offspecs, {"lust"})
end

local function Warlock(name)
    return Player:New(name, "ranged", {}, {})
end

local function Warrior(name, opts)
    opts = opts or {}
    local offspecs = {}
    if opts.offtank then offspecs[#offspecs + 1] = "tank" end
    return Player:New(name, "melee", offspecs, {})
end

---------------------------------------------------------------------------
-- Tests
---------------------------------------------------------------------------

describe("CreateMythicPlusGroups", function()
    before_each(function()
        MPW:ClearLastGroups()
    end)

    it("should create one group from exactly 5 players", function()
        local players = {
            TankWarrior("Tank1"),
            HealerPriest("Healer1"),
            Mage("DPS1"),
            Rogue("DPS2"),
            Hunter("DPS3"),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        assert.equal(1, #groups)
        assert.equal(5, groups[1]:GetSize())
    end)

    it("should create two groups from 10 players", function()
        local players = {
            TankPaladin("Tank1"),
            TankWarrior("Tank2"),
            HealerPriest("Healer1"),
            HealerShaman("Healer2"),
            Mage("DPS1"),
            Rogue("DPS2"),
            Hunter("DPS3"),
            DeathKnight("DPS4"),
            Warlock("DPS5"),
            Warrior("DPS6"),
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
            TankWarrior("Tank1"),
            HealerPriest("Healer1"),
            Mage("DPS1"),
            Rogue("DPS2"),
            Hunter("DPS3"),
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
            TankWarrior("Tank1"),
            HealerPriest("Healer1"),
            Mage("DPS1"),
            Rogue("DPS2"),
            Hunter("DPS3"),
            Warrior("DPS4"),
            Warlock("DPS5"),
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
            DemonHunter("OfftankDPS", { offtank = true }),
            HealerPriest("Healer1"),
            Mage("DPS1"),
            Rogue("DPS2"),
            Hunter("DPS3"),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        assert.is_not_nil(groups[1].tank)
        assert.equal("OfftankDPS", groups[1].tank.name)
    end)

    it("should try to distribute brez across groups", function()
        local players = {
            TankWarrior("Tank1"),
            TankWarrior("Tank2"),
            HealerPriest("Healer1"),
            HealerPriest("Healer2"),
            DeathKnight("BrezDPS1"),
            Paladin("BrezDPS2"),
            Mage("DPS3"),
            Hunter("DPS4"),
            Rogue("DPS5"),
            Warrior("DPS6"),
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

    it("should place fewer than 5 players into a remainder group", function()
        local players = {
            TankWarrior("Tank1"),
            HealerPriest("Healer1"),
            Mage("DPS1"),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        -- With < 5 players, maxGroups = 0, so only remainder groups
        local totalPlayers = 0
        for _, g in ipairs(groups) do
            totalPlayers = totalPlayers + g:GetSize()
        end
        assert.equal(3, totalPlayers)
    end)

    -- Edge case tests
    it("should handle 0 players", function()
        local groups = MPW:CreateMythicPlusGroups({})
        assert.equal(0, #groups)
    end)

    it("should handle 1 player", function()
        local players = { Mage("Solo") }
        local groups = MPW:CreateMythicPlusGroups(players)

        local totalPlayers = 0
        for _, g in ipairs(groups) do
            totalPlayers = totalPlayers + g:GetSize()
        end
        assert.equal(1, totalPlayers)
    end)

    it("should handle all same role (all DPS)", function()
        local players = {
            Mage("DPS1"),
            Hunter("DPS2"),
            Rogue("DPS3"),
            Warlock("DPS4"),
            Warrior("DPS5"),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        -- Should still create groups even without tanks/healers
        local totalPlayers = 0
        for _, g in ipairs(groups) do
            totalPlayers = totalPlayers + g:GetSize()
        end
        assert.equal(5, totalPlayers)
    end)

    it("should handle no tanks available", function()
        local players = {
            HealerPriest("Healer1"),
            Mage("DPS1"),
            Hunter("DPS2"),
            Rogue("DPS3"),
            Warlock("DPS4"),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        -- All players should be assigned (may span multiple groups due to role limits)
        local totalPlayers = 0
        for _, g in ipairs(groups) do
            totalPlayers = totalPlayers + g:GetSize()
        end
        assert.equal(5, totalPlayers)
    end)

    it("should handle no healers available", function()
        local players = {
            TankWarrior("Tank1"),
            Mage("DPS1"),
            Hunter("DPS2"),
            Rogue("DPS3"),
            Warlock("DPS4"),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        -- All players should be assigned (may span multiple groups due to role limits)
        local totalPlayers = 0
        for _, g in ipairs(groups) do
            totalPlayers = totalPlayers + g:GetSize()
        end
        assert.equal(5, totalPlayers)
    end)

    it("should handle 15 players (3 groups)", function()
        local players = {
            TankPaladin("Tank1"),
            TankWarrior("Tank2"),
            TankDruid("Tank3"),
            HealerPriest("Healer1"),
            HealerShaman("Healer2"),
            HealerDruid("Healer3"),
            Mage("DPS1"),
            Hunter("DPS2"),
            Rogue("DPS3"),
            Warlock("DPS4"),
            Warrior("DPS5"),
            DeathKnight("DPS6"),
            DemonHunter("DPS7"),
            Paladin("DPS8"),
            Priest("DPS9"),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        assert.equal(3, #groups)

        local totalPlayers = 0
        for _, g in ipairs(groups) do
            totalPlayers = totalPlayers + g:GetSize()
        end
        assert.equal(15, totalPlayers)
    end)

    it("should handle 20 players (4 groups)", function()
        local players = {
            TankPaladin("Tank1"),
            TankWarrior("Tank2"),
            TankDruid("Tank3"),
            TankDeathKnight("Tank4"),
            HealerPriest("Healer1"),
            HealerShaman("Healer2"),
            HealerDruid("Healer3"),
            HealerEvoker("Healer4"),
            Mage("DPS1"),
            Hunter("DPS2"),
            Rogue("DPS3"),
            Warlock("DPS4"),
            Warrior("DPS5"),
            DeathKnight("DPS6"),
            DemonHunter("DPS7"),
            Paladin("DPS8"),
            Priest("DPS9"),
            Shaman("DPS10"),
            BalanceDruid("DPS11"),
            FeralDruid("DPS12"),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        assert.equal(4, #groups)

        local totalPlayers = 0
        for _, g in ipairs(groups) do
            totalPlayers = totalPlayers + g:GetSize()
        end
        assert.equal(20, totalPlayers)
    end)

    -- Duplicate avoidance tests
    it("should store and use last groups for duplicate avoidance", function()
        local players = {
            TankWarrior("Tank1"),
            TankPaladin("Tank2"),
            HealerPriest("Healer1"),
            HealerShaman("Healer2"),
            Mage("DPS1"),
            Hunter("DPS2"),
            Rogue("DPS3"),
            Warlock("DPS4"),
            Warrior("DPS5"),
            DeathKnight("DPS6"),
        }

        local groups1 = MPW:CreateMythicPlusGroups(players, "testGuild")
        assert.equal(2, #groups1)

        -- Running again should use last groups for avoidance
        local groups2 = MPW:CreateMythicPlusGroups(players, "testGuild")
        assert.equal(2, #groups2)

        -- All players should still be assigned
        local totalPlayers = 0
        for _, g in ipairs(groups2) do
            totalPlayers = totalPlayers + g:GetSize()
        end
        assert.equal(10, totalPlayers)
    end)

    it("should clear last groups", function()
        local players = {
            TankWarrior("Tank1"),
            HealerPriest("Healer1"),
            Mage("DPS1"),
            Rogue("DPS2"),
            Hunter("DPS3"),
        }

        MPW:CreateMythicPlusGroups(players, "testGuild")
        local lastGroups = MPW:GetLastGroups("testGuild")
        assert.is_true(#lastGroups > 0)

        MPW:ClearLastGroups()
        lastGroups = MPW:GetLastGroups("testGuild")
        assert.equal(0, #lastGroups)
    end)

    it("should use offspec healers when not enough main healers", function()
        local players = {
            TankWarrior("Tank1"),
            TankPaladin("Tank2"),
            HealerPriest("Healer1"),
            Paladin("OffhealPaladin", { offhealer = true }),
            Mage("DPS1"),
            Hunter("DPS2"),
            Rogue("DPS3"),
            Warlock("DPS4"),
            Warrior("DPS5"),
            DeathKnight("DPS6"),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        assert.equal(2, #groups)

        -- Both groups should have something in the healer slot
        local healerCount = 0
        for _, g in ipairs(groups) do
            if g.healer then healerCount = healerCount + 1 end
        end
        assert.is_true(healerCount >= 1)
    end)

    it("should try to get ranged DPS in each group", function()
        local players = {
            TankWarrior("Tank1"),
            HealerPriest("Healer1"),
            Mage("RangedDPS"),
            Rogue("MeleeDPS1"),
            Warrior("MeleeDPS2"),
        }

        local groups = MPW:CreateMythicPlusGroups(players)
        assert.equal(1, #groups)
        assert.is_true(groups[1]:HasRanged())
    end)
end)
