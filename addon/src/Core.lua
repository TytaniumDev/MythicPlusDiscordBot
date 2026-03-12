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
    }

    -- Throttle timer for roster update events
    self.rosterUpdatePending = false

    self:RegisterComm(self.COMM_PREFIX)
    self:Print("Mythic+ Wheel loaded. Type /mpw to open.")
end

function MPW:OnEnable()
    self:RegisterEvent("GROUP_ROSTER_UPDATE")
    self:RegisterEvent("GUILD_ROSTER_UPDATE")
end

function MPW:OnDisable()
    self:UnregisterAllEvents()
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
    elseif cmd == "help" then
        MPW:Print("Commands:")
        MPW:Print("  /mpw - Toggle the main window")
        MPW:Print("  /mpw host - Start a new session")
        MPW:Print("  /mpw close - End the current session")
    else
        MPW:Print("Unknown command: " .. cmd .. ". Type /mpw help for usage.")
    end
end

---------------------------------------------------------------------------
-- Session Management
---------------------------------------------------------------------------

--- Start a new lobby session. Any guild member can host.
function MPW:StartSession()
    if self.session.status then
        self:Print("A session is already active.")
        return
    end

    self.session.status = self.Status.LOBBY
    self.session.host = UnitName("player")
    self.session.players = {}
    self.session.groups = {}

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

    self.session.status = nil
    self.session.host = nil
    self.session.players = {}
    self.session.groups = {}

    self:BroadcastSessionEnd()
    self:Print("Session ended.")
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

    self:BroadcastSessionUpdate()
end

--- Mark session as completed after wheel animation finishes.
function MPW:CompleteSession()
    self.session.status = self.Status.COMPLETED
    self:BroadcastSessionUpdate()
end

---------------------------------------------------------------------------
-- Addon Communication
---------------------------------------------------------------------------

--- Broadcast session state to the guild.
function MPW:BroadcastSessionUpdate()
    local data = {
        type = "SESSION_UPDATE",
        status = self.session.status,
        host = self.session.host,
        playerCount = #self.session.players,
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

    if data.type == "SESSION_UPDATE" then
        self:HandleSessionUpdate(data, sender)
    elseif data.type == "SESSION_END" then
        self:HandleSessionEnd(sender)
    elseif data.type == "JOIN_REQUEST" then
        self:HandleJoinRequest(data, sender)
    end
end

function MPW:HandleSessionUpdate(data, sender)
    -- Only accept updates from the session host
    if self.session.host and sender ~= self.session.host then return end

    if data.host then
        self.session.status = data.status
        self.session.host = data.host

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
    self:UpdateUI()
end

function MPW:HandleJoinRequest(data, sender)
    -- Only the host processes join requests
    if self.session.host ~= UnitName("player") then return end
    if self.session.status ~= self.Status.LOBBY then return end

    -- Validate sender matches the player data to prevent spoofing
    if not data.player or data.player.name ~= sender then return end

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
