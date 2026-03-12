---@class MythicPlusWheel
local MPW = LibStub("AceAddon-3.0"):NewAddon("MythicPlusWheel", "AceEvent-3.0", "AceComm-3.0", "AceSerializer-3.0")
_G.MythicPlusWheel = MPW

-- Addon communication prefix (max 16 chars)
MPW.COMM_PREFIX = "MPWheel"

-- Session states (mirrors shared/types.ts SessionStatus)
MPW.Status = {
    LOBBY = "lobby",
    SPINNING = "spinning",
    COMPLETED = "completed",
}

-- Role identifiers (mirrors shared/config.ts)
MPW.Roles = {
    TANK = "tank",
    HEALER = "healer",
    RANGED = "ranged",
    MELEE = "melee",
}

-- Utility identifiers
MPW.Utilities = {
    BREZ = "brez",
    LUST = "lust",
}

-- WoW spec ID → role mapping
-- Updated for Midnight (12.0.1)
MPW.SpecRoles = {
    -- Death Knight
    [250] = "tank",    -- Blood
    [251] = "melee",   -- Frost
    [252] = "melee",   -- Unholy
    -- Demon Hunter
    [577] = "melee",   -- Havoc
    [581] = "tank",    -- Vengeance
    -- Druid
    [102] = "ranged",  -- Balance
    [103] = "melee",   -- Feral
    [104] = "tank",    -- Guardian
    [105] = "healer",  -- Restoration
    -- Evoker
    [1467] = "ranged", -- Devastation
    [1468] = "healer", -- Preservation
    [1473] = "ranged", -- Augmentation
    -- Hunter
    [253] = "ranged",  -- Beast Mastery
    [254] = "ranged",  -- Marksmanship
    [255] = "melee",   -- Survival
    -- Mage
    [62] = "ranged",   -- Arcane
    [63] = "ranged",   -- Fire
    [64] = "ranged",   -- Frost
    -- Monk
    [268] = "tank",    -- Brewmaster
    [270] = "healer",  -- Mistweaver
    [269] = "melee",   -- Windwalker
    -- Paladin
    [65] = "healer",   -- Holy
    [66] = "tank",     -- Protection
    [70] = "melee",    -- Retribution
    -- Priest
    [256] = "healer",  -- Discipline
    [257] = "healer",  -- Holy
    [258] = "ranged",  -- Shadow
    -- Rogue
    [259] = "melee",   -- Assassination
    [260] = "melee",   -- Outlaw
    [261] = "melee",   -- Subtlety
    -- Shaman
    [262] = "ranged",  -- Elemental
    [263] = "melee",   -- Enhancement
    [264] = "healer",  -- Restoration
    -- Warlock
    [265] = "ranged",  -- Affliction
    [266] = "ranged",  -- Demonology
    [267] = "ranged",  -- Destruction
    -- Warrior
    [71] = "melee",    -- Arms
    [72] = "melee",    -- Fury
    [73] = "tank",     -- Protection
}

-- Class IDs that have battle rez capability
MPW.BrezClasses = {
    ["DEATHKNIGHT"] = true,
    ["DRUID"] = true,
    ["WARLOCK"] = true,
    ["PALADIN"] = true,
}

-- Class IDs that have lust/heroism capability
MPW.LustClasses = {
    ["SHAMAN"] = true,
    ["MAGE"] = true,
    ["EVOKER"] = true,
    ["HUNTER"] = true,
}

-- Max player level for current expansion (Midnight)
MPW.MAX_LEVEL = 90

-- Addon version (replaced by packager with git tag)
MPW.VERSION = "@project-version@"

-- Session timeout in seconds (default 30 minutes)
MPW.SESSION_TIMEOUT = 1800

-- Message throttle interval in seconds
MPW.COMM_THROTTLE = 0.5

-- Max number of sessions to keep in history
MPW.MAX_HISTORY = 10

-- Default saved variables
MPW.defaults = {
    profile = {
        minimap = {
            hide = false,
        },
        lastSession = nil,
        sessionHistory = {},
        framePosition = nil,
        animationSpeed = 1.0,
        soundEnabled = true,
    },
}
