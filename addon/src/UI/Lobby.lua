---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

---------------------------------------------------------------------------
-- Lobby View
-- Shows player list and "Spin" button (mirrors activity lobby UI)
---------------------------------------------------------------------------

local lobbyFrame = nil
local playerRows = {}

local ROLE_ICONS = {
    tank = "Interface\\LFGFrame\\LFGRole_BW",    -- Will use role icon coords
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

    -- Player count
    frame.countText = frame:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    frame.countText:SetPoint("TOPRIGHT", -4, -4)
    frame.countText:SetTextColor(0.7, 0.7, 0.7)

    -- Scroll frame for player list
    frame.scrollFrame = CreateFrame("ScrollFrame", "MPWLobbyScrollFrame", frame, "UIPanelScrollFrameTemplate")
    frame.scrollFrame:SetPoint("TOPLEFT", 4, -28)
    frame.scrollFrame:SetPoint("BOTTOMRIGHT", -28, 48)

    frame.scrollChild = CreateFrame("Frame", nil, frame.scrollFrame)
    frame.scrollChild:SetWidth(frame.scrollFrame:GetWidth())
    frame.scrollChild:SetHeight(1)
    frame.scrollFrame:SetScrollChild(frame.scrollChild)

    -- Spin button
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
    frame.joinButton:SetSize(120, 32)
    frame.joinButton:SetPoint("BOTTOMLEFT", 8, 8)
    frame.joinButton:SetText("Join Session")
    frame.joinButton:SetScript("OnClick", function()
        PlaySound(SOUNDKIT.IG_MAINMENU_OPTION_CHECKBOX_ON)
        MPW:RequestJoin()
    end)

    return frame
end

local function CreatePlayerRow(parent, index)
    local row = CreateFrame("Frame", nil, parent)
    row:SetHeight(24)
    row:SetPoint("TOPLEFT", 0, -(index - 1) * 26)
    row:SetPoint("TOPRIGHT", 0, -(index - 1) * 26)

    -- Role icon
    row.roleIcon = row:CreateTexture(nil, "ARTWORK")
    row.roleIcon:SetSize(20, 20)
    row.roleIcon:SetPoint("LEFT", 4, 0)

    -- Player name
    row.nameText = row:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    row.nameText:SetPoint("LEFT", row.roleIcon, "RIGHT", 8, 0)
    row.nameText:SetJustifyH("LEFT")

    -- Utility icons
    row.brezIcon = row:CreateTexture(nil, "ARTWORK")
    row.brezIcon:SetSize(16, 16)
    row.brezIcon:SetPoint("RIGHT", -28, 0)
    row.brezIcon:SetTexture("Interface\\RaidFrame\\ReadyCheck-Ready")

    row.lustIcon = row:CreateTexture(nil, "ARTWORK")
    row.lustIcon:SetSize(16, 16)
    row.lustIcon:SetPoint("RIGHT", -8, 0)
    row.lustIcon:SetTexture("Interface\\Icons\\Spell_Nature_Bloodlust")

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

    -- Update status text
    if hasSession then
        lobbyFrame.statusText:SetText("Lobby - Hosted by " .. (self.session.host or "Unknown"))
    else
        lobbyFrame.statusText:SetText("No active session")
    end

    -- Update player count
    lobbyFrame.countText:SetText(#players .. " players")

    -- Update button visibility
    lobbyFrame.spinButton:SetShown(isHost and hasSession)
    lobbyFrame.spinButton:SetEnabled(#players >= 5)
    lobbyFrame.joinButton:SetShown(not isHost and hasSession)

    -- Update player rows
    for _, row in ipairs(playerRows) do row:Hide() end

    for i, player in ipairs(players) do
        if not playerRows[i] then
            playerRows[i] = CreatePlayerRow(lobbyFrame.scrollChild, i)
        end

        local row = playerRows[i]
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

        -- Utility icons
        row.brezIcon:SetShown(player:HasBrez())
        row.lustIcon:SetShown(player:HasLust())

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
