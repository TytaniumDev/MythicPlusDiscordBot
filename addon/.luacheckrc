-- Luacheck configuration for MythicPlusWheel addon
std = "lua51"
max_line_length = 120

-- Allow setting fields on writable globals (WoW addon pattern where methods
-- are defined across multiple files via `local MPW = _G.MythicPlusWheel`
-- then `function MPW:Method() end`).
globals = {
    -- _G is written to by WoW addons to register their namespace
    _G = { other_fields = true },

    -- The addon namespace — methods are added to this table across all files
    MythicPlusWheel = { other_fields = true },

    -- WoW slash command globals
    "SLASH_MYTHICPLUSWHEEL1",
    "SLASH_MYTHICPLUSWHEEL2",
    SlashCmdList = { other_fields = true },
    UISpecialFrames = { other_fields = true },
}

read_globals = {
    -- Lua globals
    "os",

    -- WoW API functions
    "C_Timer",
    "ConvertToRaid",
    "CreateFrame",
    GameTooltip = { other_fields = true },
    "GetGuildInfo",
    "GetGuildRosterInfo",
    "GetNumGroupMembers",
    "GetNumGuildMembers",
    "GetNumSpecializations",
    "GetSpecialization",
    "GetSpecializationInfo",
    "InviteUnit",
    "IsInGuild",
    "IsInGroup",
    "IsInRaid",
    "PlaySound",
    "SendChatMessage",
    "UnitClass",
    "UnitIsGroupLeader",
    "UnitName",
    "date",
    "time",

    -- WoW UI globals
    "ChatFontNormal",
    "GameFontNormal",
    "GameFontNormalLarge",
    "GameFontNormalSmall",
    "SOUNDKIT",
    "UIParent",
    "UIPanelButtonTemplate",
    "UIPanelCloseButton",
    "UIPanelScrollFrameTemplate",
    "BackdropTemplateMixin",

    -- Libraries
    "LibStub",

    -- Lua builtins in WoW
    "strtrim",
    "wipe",
    "table",
    "string",
    "math",
    "pairs",
    "ipairs",
    "setmetatable",
    "tostring",
    "tonumber",
    "type",
    "select",
    "unpack",
    "print",
}

-- Ignore unused self in methods (common WoW addon pattern)
self = false

-- Per-file overrides
files["tests/**"] = {
    -- In tests, allow unused arguments (stub callbacks), unused functions
    -- (prebuilt player constructors kept for reference), and unused varargs.
    ignore = { "21.", "211", "212", "213" },
    globals = {
        _G = { other_fields = true },
        "os",
        "LibStub",
        "wipe",
        MythicPlusWheel = { other_fields = true },
    },
    read_globals = {
        "dofile",
        "describe",
        "it",
        "assert",
        "before_each",
        "after_each",
        "setup",
        "teardown",
        "pending",
        "spy",
        "stub",
        "mock",
    },
}
