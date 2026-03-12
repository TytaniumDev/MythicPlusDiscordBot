---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

---------------------------------------------------------------------------
-- Party Service
-- Handles party invite management for formed groups.
---------------------------------------------------------------------------

--- Invite a list of players to a party.
---@param players MPWPlayer[]
function MPW:InvitePlayers(players)
    local myName = UnitName("player")
    local invited = 0

    for _, player in ipairs(players) do
        if player.name ~= myName then
            InviteUnit(player.name)
            invited = invited + 1
        end
    end

    if invited > 0 then
        self:Print(string.format("Invited %d player(s) to your group.", invited))
    else
        self:Print("No players to invite.")
    end
end

--- Convert the current party to a raid if needed (for more than 5 players).
function MPW:ConvertToRaid()
    if GetNumGroupMembers() > 5 and not IsInRaid() then
        ConvertToRaid()
        self:Print("Converted to raid group.")
    end
end

--- Check if we can invite players (are we leader or not in a group).
---@return boolean
function MPW:CanInvite()
    if IsInGroup() then
        return UnitIsGroupLeader("player")
    end
    return true -- Not in a group, can start one
end
