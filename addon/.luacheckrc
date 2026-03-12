-- Luacheck configuration for MythicPlusWheel addon
std = "lua51"
max_line_length = 120

-- WoW global API stubs
globals = {
    "MythicPlusWheel",
    "SLASH_MYTHICPLUSWHEEL1",
    "SLASH_MYTHICPLUSWHEEL2",
    "SlashCmdList",
    "UISpecialFrames",
}

read_globals = {
    -- Lua globals
    "_G",

    -- WoW API functions
    "C_Timer",
    "ConvertToRaid",
    "CreateFrame",
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

    -- WoW UI globals
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
