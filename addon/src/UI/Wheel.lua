---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

---------------------------------------------------------------------------
-- Wheel View
-- Animated group reveal (mirrors the activity wheel animation)
---------------------------------------------------------------------------

local wheelFrame = nil
local revealTimer = nil
local currentRevealGroup = 0
local groupFrames = {}

-- Animation timing (seconds)
local REVEAL_DELAY = 1.5   -- Delay between each group reveal

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
    frame.skipButton:SetPoint("BOTTOM", 0, 8)
    frame.skipButton:SetText("Skip")
    frame.skipButton:SetScript("OnClick", function()
        MPW:SkipWheelAnimation()
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

    -- Tank line
    local yOff = -24
    local tankText = card:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    tankText:SetPoint("TOPLEFT", 8, yOff)
    local tankName = group.tank and group.tank.name or "|cFF666666(no tank)|r"
    tankText:SetText("|cFF87BCDE[T]|r " .. tankName)

    -- Healer line
    yOff = yOff - 16
    local healerText = card:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    healerText:SetPoint("TOPLEFT", 8, yOff)
    local healerName = group.healer and group.healer.name or "|cFF666666(no healer)|r"
    healerText:SetText("|cFF87FF87[H]|r " .. healerName)

    -- DPS lines
    for _, dps in ipairs(group.dps) do
        yOff = yOff - 16
        local dpsText = card:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
        dpsText:SetPoint("TOPLEFT", 8, yOff)
        local roleTag = dps:IsRanged() and "|cFFFF8787[R]|r" or "|cFFFFD187[M]|r"
        dpsText:SetText(roleTag .. " " .. dps.name)
    end

    -- Utility indicators
    local utilText = card:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    utilText:SetPoint("BOTTOMRIGHT", -6, 4)
    local utils = {}
    if group:HasBrez() then utils[#utils + 1] = "|cFF00FF00BR|r" end
    if group:HasLust() then utils[#utils + 1] = "|cFFFF4400BL|r" end
    utilText:SetText(table.concat(utils, " "))

    card:SetAlpha(0)
    return card
end

--- Show the wheel view inside the given content frame.
function MPW:ShowWheelView(parent)
    if wheelFrame then wheelFrame:Hide() end
    groupFrames = {}
    currentRevealGroup = 0

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
        groupFrames[i] = CreateGroupCard(wheelFrame.groupContainer, i, group)
    end

    -- Play wheel sound
    PlaySound(SOUNDKIT.AUCTION_WINDOW_OPEN)

    -- Start revealing groups one by one
    currentRevealGroup = 0
    self:RevealNextGroup()
end

--- Reveal the next group card with animation.
function MPW:RevealNextGroup()
    currentRevealGroup = currentRevealGroup + 1

    if currentRevealGroup > #groupFrames then
        -- All groups revealed
        self:OnWheelComplete()
        return
    end

    local card = groupFrames[currentRevealGroup]

    -- Fade in animation
    local fadeIn = card:CreateAnimationGroup()
    local alpha = fadeIn:CreateAnimation("Alpha")
    alpha:SetFromAlpha(0)
    alpha:SetToAlpha(1)
    alpha:SetDuration(0.4)
    alpha:SetSmoothing("OUT")
    fadeIn:SetScript("OnFinished", function()
        card:SetAlpha(1)
    end)
    fadeIn:Play()

    -- Play reveal sound
    PlaySound(SOUNDKIT.UI_EPICLOOT_TOAST)

    -- Schedule next reveal
    revealTimer = C_Timer.NewTimer(REVEAL_DELAY, function()
        MPW:RevealNextGroup()
    end)
end

--- Skip remaining animation and show all groups.
function MPW:SkipWheelAnimation()
    if revealTimer then
        revealTimer:Cancel()
        revealTimer = nil
    end

    for _, card in ipairs(groupFrames) do
        card:SetAlpha(1)
    end

    self:OnWheelComplete()
end

--- Called when all groups have been revealed.
function MPW:OnWheelComplete()
    if wheelFrame then
        wheelFrame.title:SetText("Groups Complete!")
        wheelFrame.skipButton:Hide()
    end

    PlaySound(SOUNDKIT.READY_CHECK)
    self:CompleteSession()
end
