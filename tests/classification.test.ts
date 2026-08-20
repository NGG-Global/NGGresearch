import { describe, expect, it } from 'vitest';
import {
  classifyVideo,
  isBenchmarkEligible,
  parseIsoDuration,
} from '@/lib/domain/classification';

describe('parseIsoDuration', () => {
  it('parses minutes and seconds', () => {
    expect(parseIsoDuration('PT16M42S')).toBe(1002);
  });

  it('parses hours', () => {
    expect(parseIsoDuration('PT1H2M15S')).toBe(3735);
  });

  it('returns null for missing or unparsable input', () => {
    expect(parseIsoDuration(null)).toBeNull();
    expect(parseIsoDuration('16:42')).toBeNull();
    expect(parseIsoDuration('PT0S')).toBeNull();
  });
});

describe('classifyVideo', () => {
  it('treats a long upload as benchmarkable long-form', () => {
    const result = classifyVideo({ durationSeconds: 1002 });
    expect(result.contentType).toBe('long_form');
    expect(result.confidence).toBe('high');
    expect(result.benchmarkEligible).toBe(true);
    expect(result.source).toBe('duration_heuristic');
  });

  it('trusts an explicit Shorts signal over duration', () => {
    const result = classifyVideo({ durationSeconds: 900, shortsProbe: true });
    expect(result.contentType).toBe('short');
    expect(result.source).toBe('youtube_shorts_probe');
    expect(result.benchmarkEligible).toBe(false);
  });

  it('classifies a very short upload as a Short from duration alone', () => {
    const result = classifyVideo({ durationSeconds: 48 });
    expect(result.contentType).toBe('short');
    expect(result.benchmarkEligible).toBe(false);
  });

  it('refuses to guess in the ambiguous 65-180 second band', () => {
    const result = classifyVideo({ durationSeconds: 120 });
    expect(result.contentType).toBe('unknown');
    expect(result.confidence).toBe('low');
    // Guessing here would pollute the comparison set.
    expect(result.benchmarkEligible).toBe(false);
  });

  it('excludes live broadcasts', () => {
    const result = classifyVideo({ durationSeconds: 4440, isLiveBroadcast: true });
    expect(result.contentType).toBe('live');
    expect(result.benchmarkEligible).toBe(false);
  });

  it('lets a manual override win and marks it as such', () => {
    const result = classifyVideo({ durationSeconds: 48, manualOverride: 'long_form' });
    expect(result.contentType).toBe('long_form');
    expect(result.source).toBe('manual_override');
    expect(result.benchmarkEligible).toBe(true);
  });

  it('never benchmarks an unknown duration', () => {
    expect(classifyVideo({ durationSeconds: null }).benchmarkEligible).toBe(false);
  });

  it('only makes long-form eligible', () => {
    expect(isBenchmarkEligible('long_form', 'high')).toBe(true);
    expect(isBenchmarkEligible('long_form', 'low')).toBe(false);
    expect(isBenchmarkEligible('short', 'high')).toBe(false);
    expect(isBenchmarkEligible('live', 'high')).toBe(false);
  });
});
