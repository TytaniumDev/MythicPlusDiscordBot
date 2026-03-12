---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

---------------------------------------------------------------------------
-- Addon Lifecycle
---------------------------------------------------------------------------

function MPW:OnInitialize()
    self.db = LibStub("AceDB-3.0"):New("MythicPlusWheelDB", MPW.defaults, true)

    -- Current session state
    self.session = {
        status = nil,    -- nil | "lobby" | "spinning" | "completed"
        players = {},    -- MPWPlayer[]
        groups = {},     -- MPWGroup[]
        host = nil,      -- player name who started the session
        locked = false,  -- lobby lock state
    }

    -- Throttle timer for roster update events
    self.rosterUpdatePending = false

    -- Session timeout timer
    self.sessionTimeoutTimer = nil
    -- Last activity timestamp for timeout tracking
    self.lastActivity = 0

    -- Comm throttle state
    self.commThrottleTimer = nil
    self.commPendingUpdate = false

    -- Initialize random seed for shuffle
    math.randomseed(tonumber(tostring({}):sub(8)) + os.time())

    self:RegisterComm(self.COMM_PREFIX)

    -- Restore last session results from SavedVariables
    if self.db.profile.lastSession then
        self:Print("Previous session results available. Type /mpw last to view.")
    end

    self:Print("Mythic+ Wheel loaded. Type /mpw to open.")
end

function MPW:OnEnable()
    self:RegisterEvent("GROUP_ROSTER_UPDATE")
    self:RegisterEvent("GUILD_ROSTER_UPDATE")
end

function MPW:OnDisable()
    self:UnregisterAllEvents()
    self:CancelSessionTimeout()
end

---------------------------------------------------------------------------
-- Slash Commands
---------------------------------------------------------------------------

SLASH_MYTHICPLUSWHEEL1 = "/mpw"
SLASH_MYTHICPLUSWHEEL2 = "/mythicpluswheel"

SlashCmdList["MYTHICPLUSWHEEL"] = function(msg)
    local cmd = strtrim(msg):lower()
    if cmd == "" or cmd == "open" then
        MPW:ToggleMainFrame()
    elseif cmd == "host" then
        MPW:StartSession()
    elseif cmd == "close" then
        MPW:EndSession()
    elseif cmd == "status" then
        MPW:PrintStatus()
    elseif cmd == "last" then
        MPW:ShowLastSession()
    elseif cmd == "leave" then
        MPW:LeaveSession()
    elseif cmd == "history" then
        MPW:ShowSessionHistory()
    elseif cmd == "help" then
        MPW:Print("Commands:")
        MPW:Print("  /mpw - Toggle the main window")
        MPW:Print("  /mpw host - Start a new session")
        MPW:Print("  /mpw close - End the current session")
        MPW:Print("  /mpw status - Show current session info")
        MPW:Print("  /mpw last - Show last session results")
        MPW:Print("  /mpw history - Show session history")
        MPW:Print("  /mpw leave - Leave the current session")
    else
        MPW:Print("Unknown command: " .. cmd .. ". Type /mpw help for usage.")
    end
end

---------------------------------------------------------------------------
-- Session Management
---------------------------------------------------------------------------

--- Show current session info.
function MPW:PrintStatus()
    if not self.session.status then
        self:Print("No active session.")
        return
    end

    self:Print("=== Session Status ===")
    self:Print("  Status: " .. self.session.status)
    self:Print("  Host: " .. (self.session.host or "Unknown"))
    self:Print("  Players: " .. #self.session.players)
    if self.session.locked then
        self:Print("  Lobby: LOCKED")
    end

    if #self.session.players > 0 then
        local tanks, healers, dps = 0, 0, 0
        for _, p in ipairs(self.session.players) do
            if p:IsTankMain() then tanks = tanks + 1
            elseif p:IsHealerMain() then healers = healers + 1
            else dps = dps + 1 end
        end
        self:Print(string.format("  Composition: %d Tank, %d Healer, %d DPS", tanks, healers, dps))
    end

    if self.session.status == self.Status.COMPLETED and #self.session.groups > 0 then
        self:Print("  Groups: " .. #self.session.groups)
    end
end

--- Show last session results from SavedVariables.
function MPW:ShowLastSession()
    local lastSession = self.db.profile.lastSession
    if not lastSession or not lastSession.groups or #lastSession.groups == 0 then
        self:Print("No previous session results saved.")
        return
    end

    self:Print("=== Last Session Results ===")
    local groups = {}
    for _, gd in ipairs(lastSession.groups) do
        groups[#groups + 1] = MPW.Group.FromDict(gd)
    end
    self:Print(self:FormatGroupSummary(groups))
end

--- Start a new lobby session. Any guild member can host.
function MPW:StartSession()
    if self.session.status then
        self:Print("A session is already active.")
        return
    end

    self.hasLeftSession = false
    self.session.status = self.Status.LOBBY
    self.session.host = UnitName("player")
    self.session.players = {}
    self.session.groups = {}
    self.session.locked = false

    -- Auto-add the host as the first player
    local hostPlayer = self:DetectLocalPlayer()
    if hostPlayer then
        self.session.players[1] = hostPlayer
    end

    self.lastActivity = time()
    self:ResetSessionTimeout()
    self:ShowMainFrame()
    self:BroadcastSessionUpdate()
    self:Print("Session started! Guild members can join via /mpw.")
end

--- End the current session and clean up.
function MPW:EndSession()
    if not self.session.status then
        self:Print("No active session.")
        return
    end

    self:CancelSessionTimeout()

    self.session.status = nil
    self.session.host = nil
    self.session.players = {}
    self.session.groups = {}
    self.session.locked = false

    self:BroadcastSessionEnd()
    self:Print("Session ended.")
end

--- Leave the current session (for non-hosts).
function MPW:LeaveSession()
    if not self.session.status then
        self:Print("No active session.")
        return
    end

    local myName = UnitName("player")
    if self.session.host == myName then
        self:Print("You are the host. Use /mpw close to end the session.")
        return
    end

    -- Send leave notification to host
    local data = {
        type = "LEAVE_REQUEST",
        playerName = myName,
    }
    local serialized = self:Serialize(data)
    self:SendCommMessage(self.COMM_PREFIX, serialized, "GUILD")

    self.session.status = nil
    self.session.host = nil
    self.session.players = {}
    self.session.groups = {}
    self.hasLeftSession = true
    self:Print("You have left the session.")
end

--- Run the group creation algorithm and transition to spinning.
function MPW:SpinGroups()
    if self.session.status ~= self.Status.LOBBY then
        self:Print("Can only spin from the lobby.")
        return
    end

    if #self.session.players < 5 then
        self:Print("Need at least 5 players to form a group.")
        return
    end

    self.session.groups = self:CreateMythicPlusGroups(self.session.players)
    self.session.status = self.Status.SPINNING

    self.lastActivity = time()
    self:BroadcastSessionUpdate()
end

--- Mark session as completed after wheel animation finishes.
function MPW:CompleteSession()
    self.session.status = self.Status.COMPLETED
    self:SaveSessionResults()
    self:BroadcastSessionUpdate()
end

--- Save session results to SavedVariables.
function MPW:SaveSessionResults()
    if not self.db then return end

    local groupData = {}
    for _, g in ipairs(self.session.groups) do
        groupData[#groupData + 1] = g:ToDict()
    end

    local sessionRecord = {
        groups = groupData,
        host = self.session.host,
        playerCount = #self.session.players,
        timestamp = time(),
    }

    self.db.profile.lastSession = sessionRecord
    self:SaveSessionToHistory(sessionRecord)
end

--- Save a session record to the history log.
---@param record table Session record with groups, host, playerCount, timestamp
function MPW:SaveSessionToHistory(record)
    if not self.db then return end

    local history = self.db.profile.sessionHistory
    if not history then
        history = {}
        self.db.profile.sessionHistory = history
    end

    -- Add to the front (most recent first)
    table.insert(history, 1, record)

    -- Trim to max history size
    while #history > self.MAX_HISTORY do
        history[#history] = nil
    end
end

--- Show session history log.
function MPW:ShowSessionHistory()
    if not self.db then
        self:Print("No session history available.")
        return
    end

    local history = self.db.profile.sessionHistory
    if not history or #history == 0 then
        self:Print("No session history available.")
        return
    end

    self:Print("=== Session History (" .. #history .. " sessions) ===")
    for i, record in ipairs(history) do
        local dateStr = record.timestamp and date("%Y-%m-%d %H:%M", record.timestamp) or "Unknown"
        local groupCount = record.groups and #record.groups or 0
        local playerCount = record.playerCount or 0
        self:Print(string.format("  %d. %s - Host: %s, %d players, %d groups",
            i, dateStr, record.host or "Unknown", playerCount, groupCount))
    end
end

--- Remove a player from the session (host only).
---@param playerName string
function MPW:KickPlayer(playerName)
    if self.session.host ~= UnitName("player") then return end
    if self.session.status ~= self.Status.LOBBY then return end

    for i, p in ipairs(self.session.players) do
        if p.name == playerName then
            table.remove(self.session.players, i)
            self:BroadcastSessionUpdate()
            self:Print(playerName .. " removed from session.")
            return
        end
    end
end

--- Lock/unlock the lobby (host only).
---@param locked boolean
function MPW:SetLobbyLocked(locked)
    if self.session.host ~= UnitName("player") then return end
    if self.session.status ~= self.Status.LOBBY then return end

    self.session.locked = locked
    self:BroadcastSessionUpdate()
    self:Print("Lobby " .. (locked and "locked." or "unlocked."))
end

---------------------------------------------------------------------------
-- Session Timeout
---------------------------------------------------------------------------

--- Reset the session timeout timer.
function MPW:ResetSessionTimeout()
    self:CancelSessionTimeout()
    self.lastActivity = time()
    self.sessionTimeoutTimer = C_Timer.NewTimer(self.SESSION_TIMEOUT, function()
        MPW:OnSessionTimeout()
    end)
end

--- Cancel the session timeout timer.
function MPW:CancelSessionTimeout()
    if self.sessionTimeoutTimer then
        self.sessionTimeoutTimer:Cancel()
        self.sessionTimeoutTimer = nil
    end
end

--- Handle session timeout.
function MPW:OnSessionTimeout()
    if not self.session.status then return end

    self:Print("Session timed out after " .. math.floor(self.SESSION_TIMEOUT / 60) .. " minutes of inactivity.")
    self:EndSession()
end

--- Touch the session activity timer (called on meaningful actions).
function MPW:TouchActivity()
    self.lastActivity = time()
    self:ResetSessionTimeout()
end

---------------------------------------------------------------------------
-- Addon Communication
---------------------------------------------------------------------------

--- Broadcast session state to the guild (throttled).
function MPW:BroadcastSessionUpdate()
    self:TouchActivity()

    -- Throttle broadcasts to avoid flooding
    if self.commThrottleTimer then
        self.commPendingUpdate = true
        return
    end

    self:SendSessionUpdate()

    self.commThrottleTimer = C_Timer.NewTimer(self.COMM_THROTTLE, function()
        self.commThrottleTimer = nil
        if self.commPendingUpdate then
            self.commPendingUpdate = false
            self:SendSessionUpdate()
        end
    end)
end

--- Send the actual session update message.
function MPW:SendSessionUpdate()
    local playerList = {}
    for _, p in ipairs(self.session.players) do
        playerList[#playerList + 1] = p:ToDict()
    end

    local data = {
        type = "SESSION_UPDATE",
        version = self.VERSION,
        status = self.session.status,
        host = self.session.host,
        playerCount = #self.session.players,
        players = playerList,
        locked = self.session.locked,
    }

    if self.session.status == self.Status.SPINNING or
       self.session.status == self.Status.COMPLETED then
        local groupData = {}
        for _, g in ipairs(self.session.groups) do
            groupData[#groupData + 1] = g:ToDict()
        end
        data.groups = groupData
    end

    local serialized = self:Serialize(data)
    self:SendCommMessage(self.COMM_PREFIX, serialized, "GUILD")
end

--- Broadcast session end to the guild.
function MPW:BroadcastSessionEnd()
    local serialized = self:Serialize({ type = "SESSION_END" })
    self:SendCommMessage(self.COMM_PREFIX, serialized, "GUILD")
end

--- Handle incoming addon messages.
function MPW:OnCommReceived(prefix, message, _distribution, sender)
    if prefix ~= self.COMM_PREFIX then return end
    if sender == UnitName("player") then return end

    local success, data = self:Deserialize(message)
    if not success then return end

    -- Version handshake warning
    if data.version and data.version ~= self.VERSION then
        if data.version ~= "@project-version@" and self.VERSION ~= "@project-version@" then
            self:Print("Warning: " .. sender .. " is using addon version " .. tostring(data.version)
                .. " (you have " .. tostring(self.VERSION) .. ")")
        end
    end

    if data.type == "SESSION_UPDATE" then
        self:HandleSessionUpdate(data, sender)
    elseif data.type == "SESSION_END" then
        self:HandleSessionEnd(sender)
    elseif data.type == "JOIN_REQUEST" then
        self:HandleJoinRequest(data, sender)
    elseif data.type == "LEAVE_REQUEST" then
        self:HandleLeaveRequest(data, sender)
    end
end

function MPW:HandleSessionUpdate(data, sender)
    -- Ignore updates after intentionally leaving a session
    if self.hasLeftSession then return end

    -- Only accept updates from the session host
    if self.session.host and sender ~= self.session.host then return end

    if data.host then
        self.session.status = data.status
        self.session.host = data.host
        self.session.locked = data.locked or false

        -- Update full player list from host
        if data.players then
            self.session.players = {}
            for _, pd in ipairs(data.players) do
                self.session.players[#self.session.players + 1] = MPW.Player.FromDict(pd)
            end
        end

        if data.groups then
            self.session.groups = {}
            for _, gd in ipairs(data.groups) do
                self.session.groups[#self.session.groups + 1] = MPW.Group.FromDict(gd)
            end
        end

        self:UpdateUI()
    end
end

function MPW:HandleSessionEnd(sender)
    -- Only accept end from the session host
    if self.session.host and sender ~= self.session.host then return end

    self.session.status = nil
    self.session.host = nil
    self.session.players = {}
    self.session.groups = {}
    self.session.locked = false
    self:UpdateUI()
end

function MPW:HandleJoinRequest(data, sender)
    -- Only the host processes join requests
    if self.session.host ~= UnitName("player") then return end
    if self.session.status ~= self.Status.LOBBY then return end

    -- Reject if lobby is locked
    if self.session.locked then return end

    -- Validate sender matches the player data to prevent spoofing
    if not data.player or data.player.name ~= sender then return end

    -- Validate guild membership
    if not self:IsGuildMember(sender) then return end

    local player = MPW.Player.FromDict(data.player)
    -- Replace if already in list
    for i, p in ipairs(self.session.players) do
        if p.name == player.name then
            self.session.players[i] = player
            self:BroadcastSessionUpdate()
            return
        end
    end

    self.session.players[#self.session.players + 1] = player
    self:BroadcastSessionUpdate()
end

function MPW:HandleLeaveRequest(data, sender)
    -- Only the host processes leave requests
    if self.session.host ~= UnitName("player") then return end
    if not data.playerName or data.playerName ~= sender then return end

    for i, p in ipairs(self.session.players) do
        if p.name == sender then
            table.remove(self.session.players, i)
            self:BroadcastSessionUpdate()
            return
        end
    end
end

---------------------------------------------------------------------------
-- Event Handlers
---------------------------------------------------------------------------

function MPW:GROUP_ROSTER_UPDATE()
    self:ThrottledUpdateUI()
end

function MPW:GUILD_ROSTER_UPDATE()
    self:ThrottledUpdateUI()
end

--- Throttle UI updates from rapid roster events (fires at most once per 0.5s).
function MPW:ThrottledUpdateUI()
    if self.rosterUpdatePending then return end
    self.rosterUpdatePending = true
    C_Timer.After(0.5, function()
        self.rosterUpdatePending = false
        self:UpdateUI()
    end)
end

---------------------------------------------------------------------------
-- UI Stubs (implemented in UI files)
---------------------------------------------------------------------------

function MPW:ToggleMainFrame()
    -- Overridden by UI/MainFrame.lua
end

function MPW:ShowMainFrame()
    -- Overridden by UI/MainFrame.lua
end

function MPW:UpdateUI()
    -- Overridden by UI/MainFrame.lua
end
