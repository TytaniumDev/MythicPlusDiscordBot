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
    local invited = {}

    for _, player in ipairs(players) do
        if player.name ~= myName then
            InviteUnit(player.name)
            invited[#invited + 1] = player.name
        end
    end

    if #invited > 0 then
        self:Print("Invited: " .. table.concat(invited, ", "))
    else
        self:Print("No players to invite.")
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
