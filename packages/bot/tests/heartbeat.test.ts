import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startHeartbeat } from '../src/core/heartbeat.js';

describe('startHeartbeat', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    vi.useFakeTimers();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heartbeat-test-'));
    file = path.join(dir, 'beat');
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes the file at once and on every interval while connected', () => {
    vi.setSystemTime(1_000);
    const stop = startHeartbeat(() => true, file, 100);
    expect(fs.readFileSync(file, 'utf-8')).toBe('1000');

    vi.advanceTimersByTime(100);
    expect(fs.readFileSync(file, 'utf-8')).toBe('1100');
    stop();
  });

  it('stops writing while disconnected, so the file goes stale', () => {
    let connected = true;
    vi.setSystemTime(1_000);
    const stop = startHeartbeat(() => connected, file, 100);

    connected = false;
    vi.advanceTimersByTime(300);
    expect(fs.readFileSync(file, 'utf-8')).toBe('1000');

    connected = true;
    vi.advanceTimersByTime(100);
    expect(fs.readFileSync(file, 'utf-8')).toBe('1400');
    stop();
  });

  it('writes nothing after stop()', () => {
    vi.setSystemTime(1_000);
    const stop = startHeartbeat(() => true, file, 100);
    stop();
    vi.advanceTimersByTime(500);
    expect(fs.readFileSync(file, 'utf-8')).toBe('1000');
  });

  it('never creates the file when the bot never connects', () => {
    const stop = startHeartbeat(() => false, file, 100);
    vi.advanceTimersByTime(500);
    expect(fs.existsSync(file)).toBe(false);
    stop();
  });
});
