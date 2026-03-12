---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

---------------------------------------------------------------------------
-- Lobby View
-- Shows player list and "Spin" button (mirrors activity lobby UI)
---------------------------------------------------------------------------

local lobbyFrame = nil
local playerRows = {}

local ROLE_ICONS = {
    tank = "Interface\\LFGFrame\\LFGRole_BW",
    healer = "Interface\\LFGFrame\\LFGRole_BW",
    ranged = "Interface\\LFGFrame\\LFGRole_BW",
    melee = "Interface\\LFGFrame\\LFGRole_BW",
}

local ROLE_TEXCOORDS = {
    tank = { 0.5, 0.75, 0, 1 },
    healer = { 0.75, 1, 0, 1 },
    ranged = { 0.25, 0.5, 0, 1 },
    melee = { 0, 0.25, 0, 1 },
}

local ROLE_COLORS = {
    tank = { r = 0.53, g = 0.76, b = 1.0 },
    healer = { r = 0.53, g = 1.0, b = 0.53 },
    ranged = { r = 1.0, g = 0.53, b = 0.53 },
    melee = { r = 1.0, g = 0.82, b = 0.53 },
}


local function CreateLobbyFrame(parent)
    local frame = CreateFrame("Frame", "MPWLobbyFrame", parent)
    frame:SetAllPoints()

    -- Status text
    frame.statusText = frame:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    frame.statusText:SetPoint("TOP", 0, -4)
    frame.statusText:SetText("Waiting for players...")

    -- Player count and role summary
    frame.countText = frame:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    frame.countText:SetPoint("TOPRIGHT", -4, -4)
    frame.countText:SetTextColor(0.7, 0.7, 0.7)

    -- Role composition summary
    frame.roleText = frame:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    frame.roleText:SetPoint("TOPRIGHT", -4, -16)
    frame.roleText:SetTextColor(0.6, 0.6, 0.6)

    -- Scroll frame for player list
    frame.scrollFrame = CreateFrame("ScrollFrame", "MPWLobbyScrollFrame", frame, "UIPanelScrollFrameTemplate")
    frame.scrollFrame:SetPoint("TOPLEFT", 4, -32)
    frame.scrollFrame:SetPoint("BOTTOMRIGHT", -28, 48)

    frame.scrollChild = CreateFrame("Frame", nil, frame.scrollFrame)
    frame.scrollChild:SetWidth(frame.scrollFrame:GetWidth())
    frame.scrollChild:SetHeight(1)
    frame.scrollFrame:SetScrollChild(frame.scrollChild)

    -- Spin button (host only)
    frame.spinButton = CreateFrame("Button", "MPWSpinButton", frame, "UIPanelButtonTemplate")
    frame.spinButton:SetSize(160, 32)
    frame.spinButton:SetPoint("BOTTOM", 0, 8)
    frame.spinButton:SetText("Spin the Wheel!")
    frame.spinButton:SetScript("OnClick", function()
        PlaySound(SOUNDKIT.IG_MAINMENU_OPTION_CHECKBOX_ON)
        MPW:SpinGroups()
    end)

    -- Join button (for non-hosts)
    frame.joinButton = CreateFrame("Button", "MPWJoinButton", frame, "UIPanelButtonTemplate")
    frame.joinButton:SetSize(100, 32)
    frame.joinButton:SetPoint("BOTTOMLEFT", 8, 8)
    frame.joinButton:SetText("Join Session")
    frame.joinButton:SetScript("OnClick", function()
        PlaySound(SOUNDKIT.IG_MAINMENU_OPTION_CHECKBOX_ON)
        MPW:RequestJoin()
    end)

    -- Leave button (for non-hosts who have joined)
    frame.leaveButton = CreateFrame("Button", "MPWLeaveButton", frame, "UIPanelButtonTemplate")
    frame.leaveButton:SetSize(100, 32)
    frame.leaveButton:SetPoint("BOTTOMLEFT", 8, 8)
    frame.leaveButton:SetText("Leave")
    frame.leaveButton:SetScript("OnClick", function()
        PlaySound(SOUNDKIT.IG_MAINMENU_OPTION_CHECKBOX_ON)
        MPW:LeaveSession()
    end)

    -- Lock lobby button (host only)
    frame.lockButton = CreateFrame("Button", "MPWLockButton", frame, "UIPanelButtonTemplate")
    frame.lockButton:SetSize(80, 24)
    frame.lockButton:SetPoint("BOTTOMRIGHT", -8, 44)
    frame.lockButton:SetText("Lock")
    frame.lockButton:SetScript("OnClick", function()
        local locked = not (MPW.session.locked or false)
        MPW:SetLobbyLocked(locked)
    end)

    return frame
end

local function CreatePlayerRow(parent, index)
    local row = CreateFrame("Frame", nil, parent)
    row:SetHeight(24)
    row:SetPoint("TOPLEFT", 0, -(index - 1) * 26)
    row:SetPoint("TOPRIGHT", 0, -(index - 1) * 26)
    row:EnableMouse(true)

    -- Class icon
    row.classIcon = row:CreateTexture(nil, "ARTWORK")
    row.classIcon:SetSize(18, 18)
    row.classIcon:SetPoint("LEFT", 4, 0)
    row.classIcon:SetTexture("Interface\\GLUES\\CHARACTERCREATE\\UI-CHARACTERCREATE-CLASSES")

    -- Role icon
    row.roleIcon = row:CreateTexture(nil, "ARTWORK")
    row.roleIcon:SetSize(20, 20)
    row.roleIcon:SetPoint("LEFT", row.classIcon, "RIGHT", 4, 0)

    -- Player name
    row.nameText = row:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    row.nameText:SetPoint("LEFT", row.roleIcon, "RIGHT", 8, 0)
    row.nameText:SetJustifyH("LEFT")

    -- Utility icons
    row.brezIcon = row:CreateTexture(nil, "ARTWORK")
    row.brezIcon:SetSize(16, 16)
    row.brezIcon:SetPoint("RIGHT", -48, 0)
    row.brezIcon:SetTexture("Interface\\RaidFrame\\ReadyCheck-Ready")

    row.lustIcon = row:CreateTexture(nil, "ARTWORK")
    row.lustIcon:SetSize(16, 16)
    row.lustIcon:SetPoint("RIGHT", -28, 0)
    row.lustIcon:SetTexture("Interface\\Icons\\Spell_Nature_Bloodlust")

    -- Kick button (host only, shown on hover)
    row.kickButton = CreateFrame("Button", nil, row, "UIPanelButtonTemplate")
    row.kickButton:SetSize(40, 18)
    row.kickButton:SetPoint("RIGHT", -4, 0)
    row.kickButton:SetText("X")
    row.kickButton:Hide()

    -- Tooltip for utility details
    row:SetScript("OnEnter", function(self)
        if self.playerData then
            GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
            GameTooltip:AddLine(self.playerData.name, 1, 1, 1)

            local role = self.playerData.mainRole
            if role then
                local color = ROLE_COLORS[role] or { r = 1, g = 1, b = 1 }
                GameTooltip:AddLine("Role: " .. role, color.r, color.g, color.b)
            end

            if #self.playerData.offspecs > 0 then
                GameTooltip:AddLine("Offspecs: " .. table.concat(self.playerData.offspecs, ", "), 0.7, 0.7, 0.7)
            end

            if self.playerData:HasBrez() then
                GameTooltip:AddLine("Battle Rez", 0, 1, 0)
            end
            if self.playerData:HasLust() then
                GameTooltip:AddLine("Bloodlust/Heroism", 1, 0.27, 0)
            end

            GameTooltip:Show()
        end

        -- Show kick button if host
        if MPW.session.host == UnitName("player") and self.playerData then
            if self.playerData.name ~= UnitName("player") then
                self.kickButton:Show()
            end
        end
    end)

    row:SetScript("OnLeave", function(self)
        GameTooltip:Hide()
        self.kickButton:Hide()
    end)

    return row
end

--- Show the lobby view inside the given content frame.
function MPW:ShowLobbyView(parent)
    if lobbyFrame then lobbyFrame:Hide() end

    lobbyFrame = CreateLobbyFrame(parent)
    lobbyFrame:Show()
end

--- Update the lobby view with current session data.
function MPW:UpdateLobbyView()
    if not lobbyFrame then return end

    local players = self.session.players
    local isHost = self.session.host == UnitName("player")
    local hasSession = self.session.status ~= nil
    local myName = UnitName("player")

    -- Update status text
    if hasSession then
        local statusStr = "Lobby - Hosted by " .. (self.session.host or "Unknown")
        if self.session.locked then
            statusStr = statusStr .. " |cFFFF0000[LOCKED]|r"
        end
        lobbyFrame.statusText:SetText(statusStr)
    else
        lobbyFrame.statusText:SetText("No active session")
    end

    -- Update player count
    lobbyFrame.countText:SetText(#players .. " players")

    -- Update role summary
    if #players > 0 then
        lobbyFrame.roleText:SetText(self:GetRoleCountSummary(players))
    else
        lobbyFrame.roleText:SetText("")
    end

    -- Check if local player is already in the session
    local isInSession = false
    for _, p in ipairs(players) do
        if p.name == myName then
            isInSession = true
            break
        end
    end

    -- Update button visibility
    lobbyFrame.spinButton:SetShown(isHost and hasSession)
    lobbyFrame.spinButton:SetEnabled(#players >= 5)
    lobbyFrame.joinButton:SetShown(not isHost and hasSession and not isInSession)
    lobbyFrame.leaveButton:SetShown(not isHost and hasSession and isInSession)
    lobbyFrame.lockButton:SetShown(isHost and hasSession)
    if isHost and hasSession then
        lobbyFrame.lockButton:SetText(self.session.locked and "Unlock" or "Lock")
    end

    -- Update player rows
    for _, row in ipairs(playerRows) do row:Hide() end

    for i, player in ipairs(players) do
        if not playerRows[i] then
            playerRows[i] = CreatePlayerRow(lobbyFrame.scrollChild, i)
        end

        local row = playerRows[i]
        row.playerData = player
        row.nameText:SetText(player.name)

        -- Set role icon
        local role = player.mainRole
        if role and ROLE_TEXCOORDS[role] then
            row.roleIcon:SetTexture(ROLE_ICONS[role])
            local tc = ROLE_TEXCOORDS[role]
            row.roleIcon:SetTexCoord(tc[1], tc[2], tc[3], tc[4])
            row.roleIcon:Show()

            local color = ROLE_COLORS[role]
            row.nameText:SetTextColor(color.r, color.g, color.b)
        else
            row.roleIcon:Hide()
            row.nameText:SetTextColor(1, 1, 1)
        end

        -- Set class icon (hidden if no class data)
        row.classIcon:Hide()

        -- Utility icons
        row.brezIcon:SetShown(player:HasBrez())
        row.lustIcon:SetShown(player:HasLust())

        -- Set up kick button for this row
        row.kickButton:SetScript("OnClick", function()
            MPW:KickPlayer(player.name)
        end)
        row.kickButton:Hide()

        row:Show()
    end

    lobbyFrame.scrollChild:SetHeight(math.max(1, #players * 26))
end

--- Send a join request to the session host.
function MPW:RequestJoin()
    if not self.session.host then
        self:Print("No active session to join.")
        return
    end

    self.hasLeftSession = false

    local playerData = MPW:DetectLocalPlayer()
    if not playerData then
        self:Print("Could not detect your spec. Make sure you have a specialization active.")
        return
    end

    local data = {
        type = "JOIN_REQUEST",
        player = playerData:ToDict(),
    }

    local serialized = self:Serialize(data)
    self:SendCommMessage(self.COMM_PREFIX, serialized, "GUILD")
    self:Print("Join request sent.")
end
