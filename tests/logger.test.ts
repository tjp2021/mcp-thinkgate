import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { log, setLogLevel, getLogLevel } from '../src/logger.js';

describe('logger', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    setLogLevel('debug');
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    setLogLevel('info');
  });

  it('writes JSON to stderr', () => {
    log('info', 'test message');
    expect(stderrSpy).toHaveBeenCalledOnce();
    const output = stderrSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('test message');
    expect(parsed.ts).toBeDefined();
  });

  it('includes data fields', () => {
    log('info', 'with data', { tier: 'fast', confidence: 0.9 });
    const output = stderrSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.tier).toBe('fast');
    expect(parsed.confidence).toBe(0.9);
  });

  it('filters by log level', () => {
    setLogLevel('warn');
    log('debug', 'should not appear');
    log('info', 'should not appear');
    log('warn', 'should appear');
    log('error', 'should appear');
    expect(stderrSpy).toHaveBeenCalledTimes(2);
  });

  it('respects level ordering', () => {
    setLogLevel('error');
    log('debug', 'no');
    log('info', 'no');
    log('warn', 'no');
    log('error', 'yes');
    expect(stderrSpy).toHaveBeenCalledOnce();
  });

  it('getLogLevel returns current level', () => {
    setLogLevel('warn');
    expect(getLogLevel()).toBe('warn');
  });

  it('outputs newline-terminated JSON', () => {
    log('info', 'test');
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output.endsWith('\n')).toBe(true);
    // Should be valid JSON without the newline
    expect(() => JSON.parse(output.trim())).not.toThrow();
  });
});
