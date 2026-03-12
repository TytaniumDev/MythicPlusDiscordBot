---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

---------------------------------------------------------------------------
-- Main Frame Controller
---------------------------------------------------------------------------

local mainFrame = nil
local currentView = nil -- "lobby" | "wheel" | "results"

local function GetMainFrame()
    if not mainFrame then
        mainFrame = _G["MPWMainFrame"]
        if mainFrame then
            mainFrame.CloseButton = _G["MPWMainFrameCloseButton"]
            mainFrame.Content = _G["MPWMainFrameContent"]
        end
    end
    return mainFrame
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
    self:UpdateUI()
end

--- Update the UI based on current session state.
function MPW:UpdateUI()
    local frame = GetMainFrame()
    if not frame or not frame:IsShown() then return end

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
