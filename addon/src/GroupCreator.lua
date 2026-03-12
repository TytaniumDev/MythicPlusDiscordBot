---@class MythicPlusWheel
local MPW = _G.MythicPlusWheel

local Group = MPW.Group

---------------------------------------------------------------------------
-- Group Formation Algorithm
-- Direct port of packages/shared/src/parallelGroupCreator.ts
---------------------------------------------------------------------------

local lastGroups = {}

--- Clear stored last-groups history.
function MPW:ClearLastGroups()
    wipe(lastGroups)
end

--- Store groups for the next run's duplicate-avoidance.
---@param groups MPWGroup[]
---@param guildId? string
function MPW:SetLastGroups(groups, guildId)
    lastGroups[guildId or "default"] = groups
end

--- Get stored last groups for a guild.
---@param guildId? string
---@return MPWGroup[]
function MPW:GetLastGroups(guildId)
    return lastGroups[guildId or "default"] or {}
end

--- Fisher-Yates shuffle (in-place).
---@param arr any[]
---@return any[]
local function shuffle(arr)
    for i = #arr, 2, -1 do
        local j = math.random(1, i)
        arr[i], arr[j] = arr[j], arr[i]
    end
    return arr
end

--- Remove a player by name from a list (in-place).
local function removeFromList(list, player)
    for i, p in ipairs(list) do
        if p:Equals(player) then
            table.remove(list, i)
            return
        end
    end
end

--- Check if a player is in a list.
local function isInList(list, player)
    for _, p in ipairs(list) do
        if p:Equals(player) then return true end
    end
    return false
end

--- Copy a table shallowly.
local function copyList(src)
    local dst = {}
    for i, v in ipairs(src) do dst[i] = v end
    return dst
end

--- Create balanced Mythic+ groups from a player list.
--- Port of createMythicPlusGroups() from parallelGroupCreator.ts.
---@param players MPWPlayer[]
---@param guildId? string
---@return MPWGroup[]
function MPW:CreateMythicPlusGroups(players, guildId)
    guildId = guildId or "default"
    local previousGroups = lastGroups[guildId] or {}

    -- Pre-compute teammate lookups
    local lastGroupsDict = {}
    for _, group in ipairs(previousGroups) do
        local members = group:GetPlayers()
        for _, member in ipairs(members) do
            if not lastGroupsDict[member.name] then
                lastGroupsDict[member.name] = {}
            end
            for _, m in ipairs(members) do
                if not m:Equals(member) then
                    lastGroupsDict[member.name][m.name] = true
                end
            end
        end
    end

    local groups = {}
    players = copyList(players)
    local usedPlayers = {}

    local maxGroups = math.floor(#players / 5)

    -- Build role pools
    local mainTanks = shuffle({})
    local offTanks = shuffle({})
    local mainHealers = shuffle({})
    local offHealers = shuffle({})
    local mainDps = shuffle({})
    local offDps = shuffle({})
    local brezPlayers = shuffle({})
    local lustPlayers = shuffle({})

    for _, p in ipairs(players) do
        if p:IsTankMain() then mainTanks[#mainTanks + 1] = p end
        if p:IsOfftank() and not p:IsTankMain() then offTanks[#offTanks + 1] = p end
        if p:IsHealerMain() then mainHealers[#mainHealers + 1] = p end
        if p:IsOffhealer() and not p:IsHealerMain() then offHealers[#offHealers + 1] = p end
        if p:IsDpsMain() then mainDps[#mainDps + 1] = p end
        if p:IsOffdps() and not p:IsDpsMain() then offDps[#offDps + 1] = p end
        if p:HasBrez() then brezPlayers[#brezPlayers + 1] = p end
        if p:HasLust() then lustPlayers[#lustPlayers + 1] = p end
    end

    shuffle(mainTanks)
    shuffle(offTanks)
    shuffle(mainHealers)
    shuffle(offHealers)
    shuffle(mainDps)
    shuffle(offDps)
    shuffle(brezPlayers)
    shuffle(lustPlayers)

    local availableTanks = {}
    for _, p in ipairs(mainTanks) do availableTanks[#availableTanks + 1] = p end
    for _, p in ipairs(offTanks) do availableTanks[#availableTanks + 1] = p end

    local availableHealers = {}
    for _, p in ipairs(mainHealers) do availableHealers[#availableHealers + 1] = p end
    for _, p in ipairs(offHealers) do availableHealers[#availableHealers + 1] = p end

    local availableDps = {}
    for _, p in ipairs(mainDps) do availableDps[#availableDps + 1] = p end
    for _, p in ipairs(offDps) do availableDps[#availableDps + 1] = p end

    local offhealersToGrab = math.max(0, maxGroups - #mainHealers)

    local function removePlayer(player)
        if player == nil then return end
        usedPlayers[player.name] = true

        if player:IsTankMain() then
            removeFromList(mainTanks, player)
            removeFromList(availableTanks, player)
        elseif player:IsOfftank() then
            removeFromList(offTanks, player)
            removeFromList(availableTanks, player)
        end

        if player:IsHealerMain() then
            removeFromList(mainHealers, player)
            removeFromList(availableHealers, player)
        elseif player:IsOffhealer() then
            removeFromList(offHealers, player)
            removeFromList(availableHealers, player)
        end

        if player:IsDpsMain() then
            removeFromList(mainDps, player)
            removeFromList(availableDps, player)
        elseif player:IsOffdps() then
            removeFromList(offDps, player)
            removeFromList(availableDps, player)
        end

        if player:HasBrez() then removeFromList(brezPlayers, player) end
        if player:HasLust() then removeFromList(lustPlayers, player) end
    end

    local function grabNextAvailablePlayer(availablePlayers, group)
        local teammates = group:GetPlayers()

        -- Build ineligible set from previous groups
        local ineligible = {}
        for _, teammate in ipairs(teammates) do
            local prev = lastGroupsDict[teammate.name]
            if prev then
                for name in pairs(prev) do
                    ineligible[name] = true
                end
            end
        end

        -- Prefer players not in previous group together
        for _, p in ipairs(availablePlayers) do
            if not ineligible[p.name] and not usedPlayers[p.name] then
                removePlayer(p)
                return p
            end
        end

        -- Fallback: anyone unused
        for _, p in ipairs(availablePlayers) do
            if not usedPlayers[p.name] then
                removePlayer(p)
                return p
            end
        end

        return nil
    end

    -- Create group slots
    for _ = 1, maxGroups do
        groups[#groups + 1] = Group:New()
    end

    -- Assign tanks
    for _, currentGroup in ipairs(groups) do
        currentGroup.tank = grabNextAvailablePlayer(availableTanks, currentGroup)
    end

    -- Fill lust spot (no tanks have lust)
    for _, currentGroup in ipairs(groups) do
        if not currentGroup:HasLust() then
            local filtered = {}
            for _, p in ipairs(lustPlayers) do
                if not isInList(availableTanks, p) then
                    filtered[#filtered + 1] = p
                end
            end
            local lustPlayer = grabNextAvailablePlayer(filtered, currentGroup)
            if lustPlayer then
                if lustPlayer:IsHealerMain() or (offhealersToGrab > 0 and lustPlayer:IsOffhealer()) then
                    currentGroup.healer = lustPlayer
                    if lustPlayer:IsOffhealer() then offhealersToGrab = offhealersToGrab - 1 end
                elseif lustPlayer:IsDpsMain() then
                    currentGroup.dps[#currentGroup.dps + 1] = lustPlayer
                end
            end
        end
    end

    -- Fill brez spot
    for _, currentGroup in ipairs(groups) do
        if not currentGroup:HasBrez() then
            local brezPlayer
            if currentGroup.healer then
                local filtered = {}
                for _, p in ipairs(brezPlayers) do
                    if not isInList(availableTanks, p) and not isInList(availableHealers, p) then
                        filtered[#filtered + 1] = p
                    end
                end
                brezPlayer = grabNextAvailablePlayer(filtered, currentGroup)
            else
                local filtered = {}
                for _, p in ipairs(brezPlayers) do
                    if not isInList(availableTanks, p) then
                        filtered[#filtered + 1] = p
                    end
                end
                brezPlayer = grabNextAvailablePlayer(filtered, currentGroup)
            end

            if brezPlayer then
                if brezPlayer:IsHealerMain() or (offhealersToGrab > 0 and brezPlayer:IsOffhealer()) then
                    currentGroup.healer = brezPlayer
                    if brezPlayer:IsOffhealer() then offhealersToGrab = offhealersToGrab - 1 end
                elseif brezPlayer:IsDpsMain() then
                    currentGroup.dps[#currentGroup.dps + 1] = brezPlayer
                end
            end
        end
    end

    -- Fill healers
    for _, currentGroup in ipairs(groups) do
        if not currentGroup.healer then
            local mainHealer = grabNextAvailablePlayer(mainHealers, currentGroup)
            if mainHealer then
                currentGroup.healer = mainHealer
            else
                local offHealer = grabNextAvailablePlayer(availableHealers, currentGroup)
                if offHealer then
                    currentGroup.healer = offHealer
                end
            end
        end
    end

    -- Try to get a ranged DPS per group
    for _, currentGroup in ipairs(groups) do
        if not currentGroup:HasRanged() then
            local filtered = {}
            for _, p in ipairs(availableDps) do
                if p:IsRanged() then filtered[#filtered + 1] = p end
            end
            local rangedDps = grabNextAvailablePlayer(filtered, currentGroup)
            if rangedDps then
                currentGroup.dps[#currentGroup.dps + 1] = rangedDps
            end
        end
    end

    -- Fill remaining DPS slots
    for _, currentGroup in ipairs(groups) do
        while #currentGroup.dps < 3 do
            local dpsPlayer = grabNextAvailablePlayer(availableDps, currentGroup)
            if not dpsPlayer then break end
            currentGroup.dps[#currentGroup.dps + 1] = dpsPlayer
        end
    end

    -- Handle remainder players
    local totalUsed = 0
    for _ in pairs(usedPlayers) do totalUsed = totalUsed + 1 end

    while totalUsed < #players do
        local remainderGroup = Group:New()
        local added = false
        while totalUsed < #players do
            local remaining = {}
            for _, p in ipairs(players) do
                if not usedPlayers[p.name] then
                    remaining[#remaining + 1] = p
                end
            end
            local player = grabNextAvailablePlayer(remaining, remainderGroup)
            if player then
                added = true
                totalUsed = totalUsed + 1
                if not remainderGroup.tank and (player:IsTankMain() or player:IsOfftank()) then
                    remainderGroup.tank = player
                elseif not remainderGroup.healer and (player:IsHealerMain() or player:IsOffhealer()) then
                    remainderGroup.healer = player
                elseif #remainderGroup.dps < 3 then
                    -- Accept any player as DPS (including role-less players)
                    remainderGroup.dps[#remainderGroup.dps + 1] = player
                else
                    -- Group full, break to create another
                    usedPlayers[player.name] = nil
                    totalUsed = totalUsed - 1
                    break
                end
            else
                break
            end
        end
        if added then
            groups[#groups + 1] = remainderGroup
        else
            break
        end
    end

    lastGroups[guildId] = groups
    return groups
end
