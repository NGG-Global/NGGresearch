import { describe, expect, it } from 'vitest';
import {
  benchmarkMetric,
  buildComparisonSet,
  MIN_BENCHMARK_SAMPLE,
} from '@/lib/benchmark';
import { makePeers, makeSnapshot, makeVideo, NOW } from './fixtures';

const SUBJECT_ID = 'subject';

function subject() {
  return makeVideo({ id: SUBJECT_ID, publishedDaysAgo: 3 });
}

function subjectSnapshot(views: number | null, extra = {}) {
  return makeSnapshot({
    videoId: SUBJECT_ID,
    target: 'h72',
    ageHours: 73,
    metrics: { views, ...extra },
  });
}

describe('buildComparisonSet', () => {
  it('collects previous comparable videos at the same milestone', () => {
    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: subjectSnapshot(620),
      candidates: makePeers([400, 450, 470, 480, 500]),
    });

    expect(set.sampleSize).toBe(5);
    expect(set.hasEnoughData).toBe(true);
    expect(set.quality).toBe('milestone');
  });

  it('excludes Shorts and live streams from a long-form comparison', () => {
    const candidates = [
      ...makePeers([400, 450, 470]),
      {
        video: makeVideo({ id: 'short-1', publishedDaysAgo: 12, durationSeconds: 48, contentType: 'short' }),
        snapshots: [makeSnapshot({ videoId: 'short-1', target: 'h72', metrics: { views: 900_000 } })],
      },
      {
        video: makeVideo({ id: 'live-1', publishedDaysAgo: 20, durationSeconds: 4440, contentType: 'live' }),
        snapshots: [makeSnapshot({ videoId: 'live-1', target: 'h72', metrics: { views: 100 } })],
      },
    ];

    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: subjectSnapshot(620),
      candidates,
    });

    expect(set.sampleSize).toBe(3);
    expect(set.peers.map((p) => p.video.id)).not.toContain('short-1');
    expect(set.peers.map((p) => p.video.id)).not.toContain('live-1');
    expect(set.exclusions.not_benchmark_eligible).toBe(2);
  });

  it('excludes videos published after the subject', () => {
    const candidates = [
      ...makePeers([400, 450]),
      {
        video: makeVideo({ id: 'newer', publishedDaysAgo: 1 }),
        snapshots: [makeSnapshot({ videoId: 'newer', target: 'h72', metrics: { views: 999 } })],
      },
    ];

    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: subjectSnapshot(620),
      candidates,
    });

    expect(set.peers.map((p) => p.video.id)).not.toContain('newer');
    expect(set.exclusions.published_after_subject).toBe(1);
  });

  it('excludes the subject from its own comparison set', () => {
    const candidates = [
      { video: subject(), snapshots: [subjectSnapshot(620)] },
      ...makePeers([400, 450]),
    ];
    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: subjectSnapshot(620),
      candidates,
    });
    expect(set.peers.map((p) => p.video.id)).not.toContain(SUBJECT_ID);
  });

  it('marks quality as mixed when a peer is only a daily backfill', () => {
    const candidates = [
      ...makePeers([400, 450, 470, 480]),
      {
        video: makeVideo({ id: 'old-1', publishedDaysAgo: 120 }),
        snapshots: [
          makeSnapshot({
            videoId: 'old-1',
            target: 'h72',
            source: 'daily_backfill',
            metrics: { views: 460 },
          }),
        ],
      },
    ];

    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: subjectSnapshot(620),
      candidates,
    });

    expect(set.sampleSize).toBe(5);
    expect(set.quality).toBe('mixed');
  });

  it('prefers a pure milestone pool once enough real captures exist', () => {
    const candidates = [
      ...makePeers([400, 450, 470, 480, 500]),
      {
        video: makeVideo({ id: 'old-1', publishedDaysAgo: 120 }),
        snapshots: [
          makeSnapshot({
            videoId: 'old-1',
            target: 'h72',
            source: 'daily_backfill',
            metrics: { views: 460 },
          }),
        ],
      },
    ];

    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: subjectSnapshot(620),
      candidates,
    });

    expect(set.quality).toBe('milestone');
    expect(set.peers.map((p) => p.video.id)).not.toContain('old-1');
  });

  it('is not usable when the subject itself is not benchmark-eligible', () => {
    const set = buildComparisonSet({
      subject: makeVideo({ id: 'short-subject', publishedDaysAgo: 3, durationSeconds: 48, contentType: 'short' }),
      target: 'h72',
      subjectSnapshot: subjectSnapshot(620),
      candidates: makePeers([400, 450, 470, 480, 500]),
    });
    expect(set.subjectEligible).toBe(false);
    expect(set.hasEnoughData).toBe(false);
  });

  it('caps the peer set at the configured maximum', () => {
    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: subjectSnapshot(620),
      candidates: makePeers(Array.from({ length: 25 }, (_, i) => 400 + i)),
    });
    expect(set.sampleSize).toBe(10);
  });
});

describe('benchmarkMetric', () => {
  it('reproduces the spec example: 620 views against a 470 median', () => {
    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: subjectSnapshot(620),
      candidates: makePeers([400, 450, 470, 480, 500]),
    });

    const result = benchmarkMetric(subjectSnapshot(620), set, 'views');
    expect(result.value).toBe(620);
    expect(result.benchmark).toBe(470);
    expect(Math.round(result.percentDifference!)).toBe(32);
    expect(result.status).toBe('strong');
    expect(result.sampleSize).toBe(5);
  });

  it('withholds a verdict below the minimum sample size', () => {
    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: subjectSnapshot(620),
      candidates: makePeers([400, 450, 470]),
    });

    const result = benchmarkMetric(subjectSnapshot(620), set, 'views');
    expect(set.sampleSize).toBeLessThan(MIN_BENCHMARK_SAMPLE);
    expect(result.status).toBe('insufficient_data');
    expect(result.benchmark).toBeNull();
    expect(result.percentDifference).toBeNull();
    // The measured value is still reported; only the comparison is withheld.
    expect(result.value).toBe(620);
  });

  it('grades a large lead as exceptional and a large deficit as weak', () => {
    const peers = makePeers([400, 450, 470, 480, 500]);
    const strong = benchmarkMetric(
      subjectSnapshot(900),
      buildComparisonSet({ subject: subject(), target: 'h72', subjectSnapshot: subjectSnapshot(900), candidates: peers }),
      'views',
    );
    const weak = benchmarkMetric(
      subjectSnapshot(300),
      buildComparisonSet({ subject: subject(), target: 'h72', subjectSnapshot: subjectSnapshot(300), candidates: peers }),
      'views',
    );
    expect(strong.status).toBe('exceptional');
    expect(weak.status).toBe('weak');
  });

  it('calls a near-median value typical', () => {
    const peers = makePeers([400, 450, 470, 480, 500]);
    const result = benchmarkMetric(
      subjectSnapshot(480),
      buildComparisonSet({ subject: subject(), target: 'h72', subjectSnapshot: subjectSnapshot(480), candidates: peers }),
      'views',
    );
    expect(result.status).toBe('typical');
  });

  it('reports a pending metric as pending rather than zero', () => {
    const snapshot = subjectSnapshot(null);
    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: snapshot,
      candidates: makePeers([400, 450, 470, 480, 500]),
    });

    const result = benchmarkMetric(snapshot, set, 'views');
    expect(result.metricState).toBe('pending');
    expect(result.value).toBeNull();
    expect(result.percentDifference).toBeNull();
    expect(result.status).toBe('insufficient_data');
  });

  it('treats a measured zero as a real value, not a missing one', () => {
    const snapshot = subjectSnapshot(0);
    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: snapshot,
      candidates: makePeers([400, 450, 470, 480, 500]),
    });

    const result = benchmarkMetric(snapshot, set, 'views');
    expect(result.metricState).toBe('available');
    expect(result.value).toBe(0);
    expect(result.percentDifference).toBe(-100);
    expect(result.status).toBe('weak');
  });

  it('inverts the grading for metrics where lower is better', () => {
    const peers = makePeers([400, 450, 470, 480, 500]).map((peer) => ({
      ...peer,
      snapshots: [
        makeSnapshot({
          videoId: peer.video.id,
          target: 'h72',
          metrics: { views: 450, subscribersLost: 30 },
        }),
      ],
    }));

    const snapshot = makeSnapshot({
      videoId: SUBJECT_ID,
      target: 'h72',
      metrics: { views: 450, subscribersLost: 5 },
    });

    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: snapshot,
      candidates: peers,
    });

    const result = benchmarkMetric(snapshot, set, 'subscribersLost');
    expect(result.higherIsBetter).toBe(false);
    // Losing far fewer subscribers than usual is a good outcome.
    expect(result.percentDifference).toBeLessThan(0);
    expect(result.status).toBe('exceptional');
  });

  it('flags a value that stands out from the peer spread once the sample is large enough', () => {
    const peers = makePeers([400, 405, 410, 415, 420, 425, 430, 435]);
    const snapshot = subjectSnapshot(2_000);
    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: snapshot,
      candidates: peers,
    });

    const result = benchmarkMetric(snapshot, set, 'views');
    expect(result.sampleSize).toBe(8);
    expect(result.standsOutFromSpread).toBe(true);
  });

  it('does not claim a standout with a small sample', () => {
    const set = buildComparisonSet({
      subject: subject(),
      target: 'h72',
      subjectSnapshot: subjectSnapshot(2_000),
      candidates: makePeers([400, 405, 410, 415, 420]),
    });
    const result = benchmarkMetric(subjectSnapshot(2_000), set, 'views');
    expect(result.standsOutFromSpread).toBe(false);
    expect(result.robustZScore).toBeNull();
  });
});

describe('benchmark determinism', () => {
  it('produces identical results for identical inputs', () => {
    const build = () =>
      benchmarkMetric(
        subjectSnapshot(620),
        buildComparisonSet({
          subject: subject(),
          target: 'h72',
          subjectSnapshot: subjectSnapshot(620),
          candidates: makePeers([400, 450, 470, 480, 500]),
        }),
        'views',
      );
    expect(build()).toEqual(build());
  });

  it('uses the fixed reference date, so tests do not drift', () => {
    expect(NOW.toISOString()).toBe('2026-08-20T12:00:00.000Z');
  });
});
