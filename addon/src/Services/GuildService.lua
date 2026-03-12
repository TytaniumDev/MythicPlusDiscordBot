---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

---------------------------------------------------------------------------
-- Guild Service
-- Handles guild roster queries and online member detection.
---------------------------------------------------------------------------

--- Get online guild members with max-level characters.
---@return table[] Array of {name, classToken, level, online}
function MPW:GetOnlineGuildMembers()
    local members = {}
    local numTotal = GetNumGuildMembers()

    for i = 1, numTotal do
        local name, _, _, level, _, _, _, _, online, _, classToken = GetGuildRosterInfo(i)
        if online and level and level >= MPW.MAX_LEVEL then
            -- Strip realm name if present
            local shortName = name and name:match("^([^%-]+)") or name
            members[#members + 1] = {
                name = shortName,
                classToken = classToken,
                level = level,
                online = true,
            }
        end
    end

    return members
end

--- Get the local player's guild name.
---@return string|nil
function MPW:GetGuildName()
    if not IsInGuild() then return nil end
    local guildName = GetGuildInfo("player")
    return guildName
end
