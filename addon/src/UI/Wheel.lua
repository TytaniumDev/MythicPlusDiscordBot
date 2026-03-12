---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

---------------------------------------------------------------------------
-- Wheel View
-- Animated group reveal (mirrors the activity wheel animation)
---------------------------------------------------------------------------

local wheelFrame = nil
local revealTimer = nil
local currentRevealGroup = 0
local currentRevealPlayer = 0 -- For per-player reveal within a group
local groupFrames = {}
local playerTexts = {} -- playerTexts[groupIndex] = { fontStrings... }

-- Animation timing (seconds) — base values, scaled by animationSpeed
local BASE_GROUP_DELAY = 1.5   -- Delay between each group reveal
local BASE_PLAYER_DELAY = 0.4  -- Delay between each player in a group
local BASE_FADE_DURATION = 0.4 -- Fade-in duration

local function GetAnimationSpeed()
    if MPW.db and MPW.db.profile then
        return MPW.db.profile.animationSpeed or 1.0
    end
    return 1.0
end

local function GetGroupDelay()
    return BASE_GROUP_DELAY / GetAnimationSpeed()
end

local function GetPlayerDelay()
    return BASE_PLAYER_DELAY / GetAnimationSpeed()
end

local function GetFadeDuration()
    return BASE_FADE_DURATION / GetAnimationSpeed()
end

local function ShouldPlaySounds()
    if MPW.db and MPW.db.profile then
        return MPW.db.profile.soundEnabled ~= false
    end
    return true
end

local function CreateWheelFrame(parent)
    local frame = CreateFrame("Frame", "MPWWheelFrame", parent)
    frame:SetAllPoints()

    -- Title
    frame.title = frame:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
    frame.title:SetPoint("TOP", 0, -4)
    frame.title:SetText("Forming Groups...")
    frame.title:SetTextColor(1, 0.82, 0)

    -- Group display area (groups revealed one at a time)
    frame.groupContainer = CreateFrame("Frame", nil, frame)
    frame.groupContainer:SetPoint("TOPLEFT", 8, -32)
    frame.groupContainer:SetPoint("BOTTOMRIGHT", -8, 48)

    -- Skip button
    frame.skipButton = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
    frame.skipButton:SetSize(100, 28)
    frame.skipButton:SetPoint("BOTTOMRIGHT", -8, 8)
    frame.skipButton:SetText("Skip")
    frame.skipButton:SetScript("OnClick", function()
        MPW:SkipWheelAnimation()
    end)

    -- Re-spin button (go back to lobby with same players)
    frame.respinButton = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
    frame.respinButton:SetSize(100, 28)
    frame.respinButton:SetPoint("BOTTOMLEFT", 8, 8)
    frame.respinButton:SetText("Re-spin")
    frame.respinButton:Hide()
    frame.respinButton:SetScript("OnClick", function()
        MPW:ReSpin()
    end)

    return frame
end

local function CreateGroupCard(parent, index, group)
    local card = CreateFrame("Frame", nil, parent, "BackdropTemplate")

    local columns = 2
    local cardWidth = (parent:GetWidth() - 16) / columns - 8
    local cardHeight = 110
    local col = (index - 1) % columns
    local row = math.floor((index - 1) / columns)

    card:SetSize(cardWidth, cardHeight)
    card:SetPoint("TOPLEFT", 4 + col * (cardWidth + 8), -(row * (cardHeight + 8)))

    card:SetBackdrop({
        bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
        edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
        tile = true, tileSize = 16, edgeSize = 12,
        insets = { left = 3, right = 3, top = 3, bottom = 3 },
    })
    card:SetBackdropColor(0.1, 0.1, 0.15, 0.9)

    -- Group header
    local header = card:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    header:SetPoint("TOP", 0, -6)
    header:SetText("|cFFFFD100Group " .. index .. "|r")

    -- Player lines (created hidden for per-player reveal)
    local texts = {}
    local yOff = -24

    -- Tank line
    local tankText = card:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    tankText:SetPoint("TOPLEFT", 8, yOff)
    local tankName = group.tank and group.tank.name or "|cFF666666(no tank)|r"
    tankText:SetText("|cFF87BCDE[T]|r " .. tankName)
    tankText:SetAlpha(0)
    texts[#texts + 1] = tankText

    -- Healer line
    yOff = yOff - 16
    local healerText = card:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    healerText:SetPoint("TOPLEFT", 8, yOff)
    local healerName = group.healer and group.healer.name or "|cFF666666(no healer)|r"
    healerText:SetText("|cFF87FF87[H]|r " .. healerName)
    healerText:SetAlpha(0)
    texts[#texts + 1] = healerText

    -- DPS lines
    for _, dps in ipairs(group.dps) do
        yOff = yOff - 16
        local dpsText = card:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
        dpsText:SetPoint("TOPLEFT", 8, yOff)
        local roleTag = dps:IsRanged() and "|cFFFF8787[R]|r" or "|cFFFFD187[M]|r"
        dpsText:SetText(roleTag .. " " .. dps.name)
        dpsText:SetAlpha(0)
        texts[#texts + 1] = dpsText
    end

    -- Utility indicators
    local utilText = card:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    utilText:SetPoint("BOTTOMRIGHT", -6, 4)
    local utils = {}
    if group:HasBrez() then utils[#utils + 1] = "|cFF00FF00BR|r" end
    if group:HasLust() then utils[#utils + 1] = "|cFFFF4400BL|r" end
    utilText:SetText(table.concat(utils, " "))
    utilText:SetAlpha(0)
    texts[#texts + 1] = utilText

    card:SetAlpha(0)
    return card, texts
end

--- Show the wheel view inside the given content frame.
function MPW:ShowWheelView(parent)
    if wheelFrame then wheelFrame:Hide() end
    groupFrames = {}
    playerTexts = {}
    currentRevealGroup = 0
    currentRevealPlayer = 0

    wheelFrame = CreateWheelFrame(parent)
    wheelFrame:Show()

    -- Start reveal sequence
    self:StartWheelReveal()
end

--- Update the wheel view.
function MPW:UpdateWheelView()
    -- Animation is self-driven via timers
end

--- Start the sequential group reveal animation.
function MPW:StartWheelReveal()
    if not wheelFrame then return end

    -- Create all group cards (hidden)
    for i, group in ipairs(self.session.groups) do
        local card, texts = CreateGroupCard(wheelFrame.groupContainer, i, group)
        groupFrames[i] = card
        playerTexts[i] = texts
    end

    -- Play wheel sound
    if ShouldPlaySounds() then
        PlaySound(SOUNDKIT.AUCTION_WINDOW_OPEN)
    end

    -- Start revealing groups one by one
    currentRevealGroup = 0
    currentRevealPlayer = 0
    self:RevealNextGroup()
end

--- Reveal the next group card with animation.
function MPW:RevealNextGroup()
    currentRevealGroup = currentRevealGroup + 1
    currentRevealPlayer = 0

    if currentRevealGroup > #groupFrames then
        -- All groups revealed
        self:OnWheelComplete()
        return
    end

    local card = groupFrames[currentRevealGroup]

    -- Fade in the card background
    local fadeIn = card:CreateAnimationGroup()
    local alpha = fadeIn:CreateAnimation("Alpha")
    alpha:SetFromAlpha(0)
    alpha:SetToAlpha(1)
    alpha:SetDuration(GetFadeDuration())
    alpha:SetSmoothing("OUT")
    fadeIn:SetScript("OnFinished", function()
        card:SetAlpha(1)
        -- Start per-player reveal
        MPW:RevealNextPlayer()
    end)
    fadeIn:Play()

    -- Play reveal sound
    if ShouldPlaySounds() then
        PlaySound(SOUNDKIT.UI_EPICLOOT_TOAST)
    end
end

--- Reveal the next player within the current group.
function MPW:RevealNextPlayer()
    currentRevealPlayer = currentRevealPlayer + 1

    local texts = playerTexts[currentRevealGroup]
    if not texts or currentRevealPlayer > #texts then
        -- All players in this group revealed, move to next group
        revealTimer = C_Timer.NewTimer(GetGroupDelay(), function()
            MPW:RevealNextGroup()
        end)
        return
    end

    local textWidget = texts[currentRevealPlayer]
    textWidget:SetAlpha(1)

    -- Schedule next player reveal
    revealTimer = C_Timer.NewTimer(GetPlayerDelay(), function()
        MPW:RevealNextPlayer()
    end)
end

--- Skip remaining animation and show all groups.
function MPW:SkipWheelAnimation()
    if revealTimer then
        revealTimer:Cancel()
        revealTimer = nil
    end

    for i, card in ipairs(groupFrames) do
        card:SetAlpha(1)
        if playerTexts[i] then
            for _, text in ipairs(playerTexts[i]) do
                text:SetAlpha(1)
            end
        end
    end

    self:OnWheelComplete()
end

--- Go back to lobby with same players and re-spin.
function MPW:ReSpin()
    if self.session.host ~= UnitName("player") then return end

    self.session.status = self.Status.LOBBY
    self.session.groups = {}
    self:BroadcastSessionUpdate()
    self:SpinGroups()
end

--- Called when all groups have been revealed.
function MPW:OnWheelComplete()
    if wheelFrame then
        wheelFrame.title:SetText("Groups Complete!")
        wheelFrame.skipButton:Hide()

        -- Show re-spin button for host
        if self.session.host == UnitName("player") then
            wheelFrame.respinButton:Show()
        end
    end

    if ShouldPlaySounds() then
        PlaySound(SOUNDKIT.READY_CHECK)
    end
    self:CompleteSession()
end
