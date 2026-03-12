---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

---------------------------------------------------------------------------
-- Main Frame Controller
---------------------------------------------------------------------------

local mainFrame = nil
local currentView = nil -- "lobby" | "wheel" | "results"
local isMinimized = false

local MIN_WIDTH = 400
local MIN_HEIGHT = 350
local MAX_WIDTH = 900
local MAX_HEIGHT = 700

local function GetMainFrame()
    if not mainFrame then
        mainFrame = _G["MPWMainFrame"]
        if mainFrame then
            mainFrame.CloseButton = _G["MPWMainFrameCloseButton"]
            mainFrame.Content = _G["MPWMainFrameContent"]

            -- Restore saved position
            if MPW.db and MPW.db.profile.framePosition then
                local pos = MPW.db.profile.framePosition
                mainFrame:ClearAllPoints()
                mainFrame:SetPoint(pos.point, UIParent, pos.relPoint, pos.x, pos.y)
            end

            -- Make frame resizable
            mainFrame:SetResizable(true)
            mainFrame:SetResizeBounds(MIN_WIDTH, MIN_HEIGHT, MAX_WIDTH, MAX_HEIGHT)

            -- Resize handle
            local resizer = CreateFrame("Button", nil, mainFrame)
            resizer:SetSize(16, 16)
            resizer:SetPoint("BOTTOMRIGHT")
            resizer:SetNormalTexture("Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Up")
            resizer:SetHighlightTexture("Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Highlight")
            resizer:SetPushedTexture("Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Down")
            resizer:SetScript("OnMouseDown", function()
                mainFrame:StartSizing("BOTTOMRIGHT")
            end)
            resizer:SetScript("OnMouseUp", function()
                mainFrame:StopMovingOrSizing()
                MPW:SaveFramePosition()
            end)

            -- Save position on drag stop
            mainFrame:SetScript("OnDragStop", function(self)
                self:StopMovingOrSizing()
                MPW:SaveFramePosition()
            end)
            mainFrame:SetScript("OnMouseUp", function(self)
                self:StopMovingOrSizing()
                MPW:SaveFramePosition()
            end)

            -- Minimize button
            local minimizeBtn = CreateFrame("Button", nil, mainFrame)
            minimizeBtn:SetSize(20, 20)
            minimizeBtn:SetPoint("TOPRIGHT", mainFrame.CloseButton, "TOPLEFT", -2, 0)
            minimizeBtn:SetNormalFontObject("GameFontNormal")

            local minText = minimizeBtn:CreateFontString(nil, "OVERLAY", "GameFontNormal")
            minText:SetPoint("CENTER")
            minText:SetText("_")
            minText:SetTextColor(1, 0.82, 0)
            minimizeBtn:SetScript("OnClick", function()
                MPW:ToggleMinimize()
            end)
            mainFrame.minimizeButton = minimizeBtn
        end
    end
    return mainFrame
end

--- Save the current frame position to SavedVariables.
function MPW:SaveFramePosition()
    local frame = GetMainFrame()
    if not frame or not self.db then return end

    local point, _, relPoint, x, y = frame:GetPoint()
    self.db.profile.framePosition = {
        point = point,
        relPoint = relPoint,
        x = x,
        y = y,
    }
end

--- Toggle frame minimize state.
function MPW:ToggleMinimize()
    local frame = GetMainFrame()
    if not frame then return end

    isMinimized = not isMinimized
    if isMinimized then
        frame.Content:Hide()
        frame:SetHeight(40)
    else
        frame.Content:Show()
        frame:SetHeight(500)
        self:UpdateUI()
    end
end

--- Toggle main frame visibility.
function MPW:ToggleMainFrame()
    local frame = GetMainFrame()
    if not frame then
        self:Print("Error: Main frame not found.")
        return
    end

    if frame:IsShown() then
        frame:Hide()
        PlaySound(SOUNDKIT.IG_MAINMENU_CLOSE)
    else
        frame:Show()
        PlaySound(SOUNDKIT.IG_MAINMENU_OPEN)
        isMinimized = false
        frame.Content:Show()
        self:UpdateUI()
    end
end

--- Show the main frame (without toggling).
function MPW:ShowMainFrame()
    local frame = GetMainFrame()
    if not frame then return end

    if not frame:IsShown() then
        frame:Show()
        PlaySound(SOUNDKIT.IG_MAINMENU_OPEN)
    end
    isMinimized = false
    frame.Content:Show()
    self:UpdateUI()
end

--- Update the UI based on current session state.
function MPW:UpdateUI()
    local frame = GetMainFrame()
    if not frame or not frame:IsShown() then return end
    if isMinimized then return end

    local status = self.session.status

    if status == self.Status.LOBBY then
        if currentView ~= "lobby" then
            self:ShowLobbyView(frame.Content)
            currentView = "lobby"
        end
        self:UpdateLobbyView()
    elseif status == self.Status.SPINNING then
        if currentView ~= "wheel" then
            self:ShowWheelView(frame.Content)
            currentView = "wheel"
        end
        self:UpdateWheelView()
    elseif status == self.Status.COMPLETED then
        if currentView ~= "results" then
            self:ShowGroupDisplayView(frame.Content)
            currentView = "results"
        end
        self:UpdateGroupDisplayView()
    else
        -- No session: show idle/join state
        if currentView ~= "lobby" then
            self:ShowLobbyView(frame.Content)
            currentView = "lobby"
        end
        self:UpdateLobbyView()
    end
end

--- Register the frame with ESC key to close.
table.insert(UISpecialFrames, "MPWMainFrame")
