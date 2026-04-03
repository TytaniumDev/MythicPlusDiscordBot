import { performance } from 'perf_hooks';
import { WoWPlayer, WoWGroup, clear, setLastGroups, createMythicPlusGroups } from '../src/index.js';

function createMockPlayers(count: number): WoWPlayer[] {
    const players: WoWPlayer[] = [];
    const roles = ['Tank', 'Healer', 'Melee', 'Ranged'];
    for (let i = 0; i < count; i++) {
        players.push(WoWPlayer.create(`Player${i}`, [roles[i % 4]]));
    }
    return players;
}

function runBenchmark() {
    console.log('--- Benchmarking createMythicPlusGroups ---');
    const totalPlayers = 2000; // 400 groups
    const players = createMockPlayers(totalPlayers);

    clear();
    const historyGroups: WoWGroup[] = [];
    for (let j = 0; j < 10; j++) {
        // shift players to create new history groups
        const shifted = [...players.slice(j * 10), ...players.slice(0, j * 10)];
        for (let i = 0; i < totalPlayers; i += 5) {
            const groupPlayers = shifted.slice(i, i + 5);
            if (groupPlayers.length === 5) {
                const g = new WoWGroup();
                g.tank = groupPlayers[0];
                g.healer = groupPlayers[1];
                g.dps = groupPlayers.slice(2, 5);
                historyGroups.push(g);
            }
        }
    }
    setLastGroups(historyGroups);

    const iterations = 50;

    // Warmup
    for (let i = 0; i < 5; i++) {
        createMythicPlusGroups([...players], false);
    }

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        createMythicPlusGroups([...players], false);
    }
    const end = performance.now();

    console.log(`Players: ${totalPlayers}, History Groups: ${historyGroups.length}, Iterations: ${iterations}`);
    console.log(`Total Time: ${(end - start).toFixed(2)} ms`);
    console.log(`Average Time per Run: ${((end - start) / iterations).toFixed(2)} ms`);
}

runBenchmark();
