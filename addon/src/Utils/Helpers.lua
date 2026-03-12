---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

---------------------------------------------------------------------------
-- Utility Helpers
---------------------------------------------------------------------------

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
