---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

---------------------------------------------------------------------------
-- Utility Helpers
---------------------------------------------------------------------------

--- WoW class colors (RAID_CLASS_COLORS equivalent for addon use).
MPW.CLASS_COLORS = {
    DEATHKNIGHT = { r = 0.77, g = 0.12, b = 0.23, hex = "C41E3A" },
    DEMONHUNTER = { r = 0.64, g = 0.19, b = 0.79, hex = "A330C9" },
    DRUID       = { r = 1.00, g = 0.49, b = 0.04, hex = "FF7C0A" },
    EVOKER      = { r = 0.20, g = 0.58, b = 0.50, hex = "33937F" },
    HUNTER      = { r = 0.67, g = 0.83, b = 0.45, hex = "AAD372" },
    MAGE        = { r = 0.25, g = 0.78, b = 0.92, hex = "3FC7EB" },
    MONK        = { r = 0.00, g = 1.00, b = 0.60, hex = "00FF98" },
    PALADIN     = { r = 0.96, g = 0.55, b = 0.73, hex = "F48CBA" },
    PRIEST      = { r = 1.00, g = 1.00, b = 1.00, hex = "FFFFFF" },
    ROGUE       = { r = 1.00, g = 0.96, b = 0.41, hex = "FFF468" },
    SHAMAN      = { r = 0.00, g = 0.44, b = 0.87, hex = "0070DD" },
    WARLOCK     = { r = 0.53, g = 0.53, b = 0.93, hex = "8788EE" },
    WARRIOR     = { r = 0.78, g = 0.61, b = 0.43, hex = "C69B6D" },
}

--- Format a group summary for chat output.
---@param groups MPWGroup[]
---@return string
function MPW:FormatGroupSummary(groups)
    local lines = {}
    for i, group in ipairs(groups) do
        local parts = { "Group " .. i .. ":" }

        if group.tank then
            parts[#parts + 1] = "[T] " .. group.tank.name
        end
        if group.healer then
            parts[#parts + 1] = "[H] " .. group.healer.name
        end
        for _, dps in ipairs(group.dps) do
            parts[#parts + 1] = "[D] " .. dps.name
        end

        local utils = {}
        if group:HasBrez() then utils[#utils + 1] = "BR" end
        if group:HasLust() then utils[#utils + 1] = "BL" end
        if #utils > 0 then
            parts[#parts + 1] = "(" .. table.concat(utils, "/") .. ")"
        end

        lines[#lines + 1] = table.concat(parts, " ")
    end
    return table.concat(lines, "\n")
end

--- Post group results to guild chat.
---@param groups MPWGroup[]
function MPW:PostToGuildChat(groups)
    if not IsInGuild() then
        self:Print("Not in a guild.")
        return
    end

    SendChatMessage("=== Mythic+ Groups ===", "GUILD")
    for i, group in ipairs(groups) do
        local tankName = group.tank and group.tank.name or "(none)"
        local healerName = group.healer and group.healer.name or "(none)"
        local dpsNames = {}
        for _, dps in ipairs(group.dps) do
            dpsNames[#dpsNames + 1] = dps.name
        end

        local msg = string.format(
            "Group %d: T=%s H=%s D=%s",
            i, tankName, healerName, table.concat(dpsNames, ",")
        )
        SendChatMessage(msg, "GUILD")
    end
end

--- Get a role-colored name string for display.
---@param player MPWPlayer
---@return string
function MPW:ColoredPlayerName(player)
    local colors = {
        tank = "87BCDE",
        healer = "87FF87",
        ranged = "FF8787",
        melee = "FFD187",
    }
    local color = colors[player.mainRole] or "FFFFFF"
    return "|cFF" .. color .. player.name .. "|r"
end

--- Get a class-colored name string for display.
---@param name string
---@param classToken string
---@return string
function MPW:ClassColoredName(name, classToken)
    local classColor = self.CLASS_COLORS[classToken]
    if classColor then
        return "|cFF" .. classColor.hex .. name .. "|r"
    end
    return name
end

--- Get role count summary string.
---@param players MPWPlayer[]
---@return string
function MPW:GetRoleCountSummary(players)
    local tanks, healers, dps = 0, 0, 0
    for _, p in ipairs(players) do
        if p:IsTankMain() then tanks = tanks + 1
        elseif p:IsHealerMain() then healers = healers + 1
        else dps = dps + 1 end
    end
    return string.format("%d Tank, %d Healer, %d DPS", tanks, healers, dps)
end

--- Get group quality score description.
---@param group MPWGroup
---@return string
function MPW:GetGroupQuality(group)
    local parts = {}
    if group:HasBrez() then parts[#parts + 1] = "Brez" end
    if group:HasLust() then parts[#parts + 1] = "Lust" end
    if group:HasRanged() then parts[#parts + 1] = "Ranged" end
    if #parts == 0 then return "Missing utilities" end
    return table.concat(parts, ", ")
end

--- Copy group results to clipboard (WoW API limitation: uses EditBox workaround).
---@param groups MPWGroup[]
function MPW:CopyGroupsToClipboard(groups)
    local text = self:FormatGroupSummary(groups)
    -- WoW does not have a direct clipboard API. We create a temporary EditBox.
    local editBox = self.clipboardEditBox
    if not editBox then
        editBox = CreateFrame("EditBox", "MPWClipboardEditBox", UIParent)
        editBox:SetMultiLine(true)
        editBox:SetMaxLetters(0)
        editBox:SetAutoFocus(false)
        editBox:SetFontObject("ChatFontNormal")
        editBox:SetWidth(0)
        editBox:SetHeight(0)
        editBox:SetPoint("CENTER")
        editBox:Hide()
        self.clipboardEditBox = editBox
    end
    editBox:SetText(text)
    editBox:HighlightText()
    editBox:SetFocus()
    self:Print("Group results copied. Press Ctrl+C to copy, then Escape.")
end
