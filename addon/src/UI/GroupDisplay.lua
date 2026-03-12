---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

---------------------------------------------------------------------------
-- Group Display View (final results)
---------------------------------------------------------------------------

local displayFrame = nil

local function CreateGroupDisplayFrame(parent)
    local frame = CreateFrame("Frame", "MPWGroupDisplayFrame", parent)
    frame:SetAllPoints()

    -- Title
    frame.title = frame:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
    frame.title:SetPoint("TOP", 0, -4)
    frame.title:SetText("|cFFFFD100Mythic+ Groups|r")

    -- Scroll frame for group results
    frame.scrollFrame = CreateFrame("ScrollFrame", "MPWResultsScrollFrame", frame, "UIPanelScrollFrameTemplate")
    frame.scrollFrame:SetPoint("TOPLEFT", 4, -28)
    frame.scrollFrame:SetPoint("BOTTOMRIGHT", -28, 48)

    frame.scrollChild = CreateFrame("Frame", nil, frame.scrollFrame)
    frame.scrollChild:SetWidth(frame.scrollFrame:GetWidth())
    frame.scrollChild:SetHeight(1)
    frame.scrollFrame:SetScrollChild(frame.scrollChild)

    -- Invite My Group button
    frame.inviteButton = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
    frame.inviteButton:SetSize(120, 28)
    frame.inviteButton:SetPoint("BOTTOMLEFT", 8, 8)
    frame.inviteButton:SetText("Invite My Group")
    frame.inviteButton:SetScript("OnClick", function()
        MPW:InviteMyGroup()
    end)

    -- Post to Guild Chat button
    frame.postButton = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
    frame.postButton:SetSize(100, 28)
    frame.postButton:SetPoint("BOTTOM", -60, 8)
    frame.postButton:SetText("Post to Guild")
    frame.postButton:SetScript("OnClick", function()
        MPW:PostToGuildChat(MPW.session.groups)
    end)

    -- Copy to Clipboard button
    frame.copyButton = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
    frame.copyButton:SetSize(80, 28)
    frame.copyButton:SetPoint("BOTTOM", 40, 8)
    frame.copyButton:SetText("Copy")
    frame.copyButton:SetScript("OnClick", function()
        MPW:CopyGroupsToClipboard(MPW.session.groups)
    end)

    -- New Session button (host only)
    frame.newButton = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
    frame.newButton:SetSize(100, 28)
    frame.newButton:SetPoint("BOTTOMRIGHT", -8, 8)
    frame.newButton:SetText("New Session")
    frame.newButton:SetScript("OnClick", function()
        MPW:EndSession()
        MPW:StartSession()
    end)

    return frame
end

local function CreatePlayerLine(card, prefix, color, player, lineY)
    local lineFrame = CreateFrame("Frame", nil, card)
    lineFrame:SetPoint("TOPLEFT", 12, lineY)
    lineFrame:SetPoint("TOPRIGHT", -12, lineY)
    lineFrame:SetHeight(14)
    lineFrame:EnableMouse(true)

    local text = lineFrame:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    text:SetPoint("LEFT")
    if player then
        local utilStr = ""
        if player:HasBrez() then utilStr = utilStr .. " |cFF00FF00[BR]|r" end
        if player:HasLust() then utilStr = utilStr .. " |cFFFF4400[BL]|r" end
        text:SetText(color .. prefix .. "|r  " .. player.name .. utilStr)
    else
        text:SetText("|cFF666666" .. prefix .. " (empty)|r")
    end

    -- Tooltip on hover showing player details
    if player then
        lineFrame:SetScript("OnEnter", function(self)
            GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
            GameTooltip:AddLine(player.name, 1, 1, 1)
            if player.mainRole then
                GameTooltip:AddLine("Role: " .. player.mainRole, 0.8, 0.8, 0.8)
            end
            if #player.offspecs > 0 then
                GameTooltip:AddLine("Offspecs: " .. table.concat(player.offspecs, ", "), 0.6, 0.6, 0.6)
            end
            if player:HasBrez() then
                GameTooltip:AddLine("Battle Rez", 0, 1, 0)
            end
            if player:HasLust() then
                GameTooltip:AddLine("Bloodlust/Heroism", 1, 0.27, 0)
            end
            GameTooltip:Show()
        end)
        lineFrame:SetScript("OnLeave", function()
            GameTooltip:Hide()
        end)
    end

    return lineFrame
end

local function RenderGroupCard(parent, index, group, yOffset)
    local cardHeight = 106

    -- Card background
    local card = CreateFrame("Frame", nil, parent, "BackdropTemplate")
    card:SetPoint("TOPLEFT", 0, -yOffset)
    card:SetPoint("TOPRIGHT", 0, -yOffset)
    card:SetHeight(cardHeight)
    card:SetBackdrop({
        bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
        edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
        tile = true, tileSize = 16, edgeSize = 12,
        insets = { left = 3, right = 3, top = 3, bottom = 3 },
    })
    card:SetBackdropColor(0.1, 0.1, 0.15, 0.9)

    -- Color-code completeness
    local size = group:GetSize()
    local completenessColor
    if size == 5 then
        completenessColor = "|cFF00FF00"
    elseif size == 4 then
        completenessColor = "|cFFFFFF00"
    else
        completenessColor = "|cFFFF0000"
    end

    -- Group header
    local header = card:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    header:SetPoint("TOPLEFT", 8, -6)
    header:SetText("|cFFFFD100Group " .. index .. "|r  " .. completenessColor .. "(" .. size .. "/5)|r")

    -- Utility badges and quality score
    local badges = card:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    badges:SetPoint("TOPRIGHT", -8, -8)
    local parts = {}
    if group:HasBrez() then parts[#parts + 1] = "|cFF00FF00Brez|r" end
    if group:HasLust() then parts[#parts + 1] = "|cFFFF4400Lust|r" end
    if group:HasRanged() then parts[#parts + 1] = "|cFF87BCDERanged|r" end
    badges:SetText(table.concat(parts, "  "))

    -- Player lines with tooltips
    local lineY = -24
    CreatePlayerLine(card, "TANK", "|cFF87BCDE", group.tank, lineY)
    lineY = lineY - 14
    CreatePlayerLine(card, "HEAL", "|cFF87FF87", group.healer, lineY)
    lineY = lineY - 14
    for _, dps in ipairs(group.dps) do
        local tag = dps:IsRanged() and "RDPS" or "MDPS"
        local color = dps:IsRanged() and "|cFFFF8787" or "|cFFFFD187"
        CreatePlayerLine(card, tag, color, dps, lineY)
        lineY = lineY - 14
    end

    return cardHeight + 8
end

--- Show the group display view.
function MPW:ShowGroupDisplayView(parent)
    if displayFrame then displayFrame:Hide() end

    displayFrame = CreateGroupDisplayFrame(parent)
    displayFrame:Show()
end

--- Update the group display with session results.
function MPW:UpdateGroupDisplayView()
    if not displayFrame then return end

    -- Clear old children from scroll child
    local children = { displayFrame.scrollChild:GetChildren() }
    for _, child in ipairs(children) do
        child:Hide()
        child:SetParent(nil)
    end

    local isHost = self.session.host == UnitName("player")
    displayFrame.newButton:SetShown(isHost)

    -- Render each group
    local yOffset = 0
    for i, group in ipairs(self.session.groups) do
        local height = RenderGroupCard(displayFrame.scrollChild, i, group, yOffset)
        yOffset = yOffset + height
    end

    displayFrame.scrollChild:SetHeight(math.max(1, yOffset))
end

--- Invite players from the group containing the local player.
function MPW:InviteMyGroup()
    local myName = UnitName("player")
    for _, group in ipairs(self.session.groups) do
        for _, player in ipairs(group:GetPlayers()) do
            if player.name == myName then
                -- Found my group, invite everyone else
                local invited = {}
                for _, member in ipairs(group:GetPlayers()) do
                    if member.name ~= myName then
                        InviteUnit(member.name)
                        invited[#invited + 1] = member.name
                    end
                end
                if #invited > 0 then
                    self:Print("Invited: " .. table.concat(invited, ", "))
                end
                return
            end
        end
    end
    self:Print("Could not find your group.")
end
