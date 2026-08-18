import assert from 'node:assert/strict';
import test from 'node:test';
import { formatUtc8Timestamp } from '../src/app/shared/utc8-timestamp.ts';

test('formats a valid UTC+8 page-update timestamp', () => {
  assert.equal(
    formatUtc8Timestamp('2026-08-18T15:48+08:00'),
    '2026 年 8 月 18 日 15:48（UTC+8）',
  );
});

test('rejects non-UTC+8 offsets and malformed calendar values', () => {
  for (const timestamp of [
    '2026-08-18T00:00-07:00',
    '2026-08-18T15:48Z',
    '2026-08-18T16:48+09:00',
    '2026-02-29T15:48+08:00',
    '2026-13-18T15:48+08:00',
    '2026-08-18T24:00+08:00',
    '2026-08-18T15:60+08:00',
  ]) {
    assert.throws(
      () => formatUtc8Timestamp(timestamp),
      new Error(`Invalid page update timestamp: ${timestamp}`),
    );
  }
});
