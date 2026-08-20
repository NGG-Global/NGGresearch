import { describe, expect, it } from 'vitest';
import { aggregateReachByVideo, parseReachCsv } from '@/lib/youtube/reporting-api';
import { buildDataset, reachForWindow } from '@/lib/sync/reach';

const HEADER = 'date,channel_id,video_id,impressions,impressions_ctr';

describe('parseReachCsv', () => {
  it('parses a well-formed reach report', () => {
    const csv = [
      HEADER,
      '20260818,UC123,vid-1,120000,0.082',
      '20260818,UC123,vid-2,45000,0.051',
    ].join('\n');

    const result = parseReachCsv(csv, 'report-1');
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      videoId: 'vid-1',
      date: '2026-08-18',
      impressions: 120_000,
    });
    // Ratios are normalised to percentages for display.
    expect(result.rows[0]!.impressionsCtr).toBeCloseTo(8.2, 5);
  });

  it('accepts alternative column names for impressions and CTR', () => {
    const csv = [
      'date,video_id,thumbnail_impressions,thumbnail_impressions_ctr',
      '20260818,vid-1,1000,0.05',
    ].join('\n');

    const result = parseReachCsv(csv, 'report-1');
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.rows[0]!.impressions).toBe(1000);
    expect(result.rows[0]!.impressionsCtr).toBeCloseTo(5, 5);
  });

  it('reports unavailable, with the headers, when no impressions column exists', () => {
    const csv = ['date,video_id,views\n20260818,vid-1,10'].join('\n');
    const result = parseReachCsv(csv, 'report-1');

    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    // The reason names what actually arrived, rather than guessing a column.
    expect(result.reason).toContain('views');
  });

  it('treats a header-only report as pending, not as zero', () => {
    const result = parseReachCsv(HEADER, 'report-1');
    expect(result.status).toBe('pending');
  });

  it('treats an empty body as pending', () => {
    expect(parseReachCsv('', 'report-1').status).toBe('pending');
  });

  it('leaves a blank CTR cell unknown rather than zero', () => {
    const csv = [HEADER, '20260818,UC123,vid-1,120000,'].join('\n');
    const result = parseReachCsv(csv, 'report-1');
    if (result.status !== 'ready') throw new Error('expected ready');
    expect(result.rows[0]!.impressions).toBe(120_000);
    expect(result.rows[0]!.impressionsCtr).toBeNull();
  });
});

describe('aggregateReachByVideo', () => {
  it('sums impressions and weights CTR by impressions', () => {
    const aggregated = aggregateReachByVideo([
      { videoId: 'v1', date: '2026-08-18', impressions: 1000, impressionsCtr: 10 },
      { videoId: 'v1', date: '2026-08-19', impressions: 9000, impressionsCtr: 5 },
    ]);

    const result = aggregated.get('v1');
    expect(result?.impressions).toBe(10_000);
    // Impression-weighted: (1000*10 + 9000*5) / 10000 = 5.5, not the plain 7.5.
    expect(result?.impressionsCtr).toBeCloseTo(5.5, 5);
  });

  it('reports no impressions as null rather than zero', () => {
    const aggregated = aggregateReachByVideo([
      { videoId: 'v1', date: '2026-08-18', impressions: null, impressionsCtr: null },
    ]);
    expect(aggregated.get('v1')?.impressions).toBeNull();
  });
});

describe('reachForWindow', () => {
  const dataset = buildDataset([
    { videoId: 'v1', date: '2026-08-18', impressions: 1000, impressionsCtr: 8 },
    { videoId: 'v1', date: '2026-08-19', impressions: 2000, impressionsCtr: 6 },
    { videoId: 'v2', date: '2026-08-18', impressions: 500, impressionsCtr: 4 },
  ]);

  it('sums a window that the reports fully cover', () => {
    const result = reachForWindow(dataset, 'v1', ['2026-08-18', '2026-08-19']);
    expect(result.impressions).toBe(3000);
    expect(result.impressionsCtr).toBeCloseTo((1000 * 8 + 2000 * 6) / 3000, 5);
  });

  it('returns unknown for a window that reaches beyond report coverage', () => {
    // 2026-08-20 was never described by a report, so the total is unknowable.
    const result = reachForWindow(dataset, 'v1', ['2026-08-19', '2026-08-20']);
    expect(result.impressions).toBeNull();
    expect(result.impressionsCtr).toBeNull();
  });

  it('treats a covered day with no row for the video as a measured zero', () => {
    const result = reachForWindow(dataset, 'v2', ['2026-08-18', '2026-08-19']);
    // v2 appears only on the 18th; the 19th is covered, so it really was zero.
    expect(result.impressions).toBe(500);
  });

  it('returns unknown for a video absent from an unavailable dataset', () => {
    const empty = buildDataset([]);
    const result = reachForWindow(empty, 'v1', ['2026-08-18']);
    expect(result.impressions).toBeNull();
  });

  it('warns about rows that carry no date', () => {
    const withUndated = buildDataset([
      { videoId: 'v1', date: null, impressions: 100, impressionsCtr: 5 },
    ]);
    expect(withUndated.warnings.join(' ')).toContain('חסרות תאריך');
    expect(withUndated.available).toBe(false);
  });
});
