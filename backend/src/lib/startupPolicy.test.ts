import assert from 'node:assert/strict';
import test from 'node:test';
import { getStartupPolicy } from './startupPolicy';

test('defaults to current startup behavior when controls are unset', () => {
  assert.deepEqual(getStartupPolicy({}), { seed: true, backgroundJobs: true });
});

test('disables seed and background jobs when explicitly false', () => {
  assert.deepEqual(getStartupPolicy({ STARTUP_SEED_ENABLED: 'false', BACKGROUND_JOBS_ENABLED: 'false' }), {
    seed: false,
    backgroundJobs: false,
  });
});

test('explicit true keeps seed and jobs enabled', () => {
  assert.deepEqual(getStartupPolicy({ STARTUP_SEED_ENABLED: 'true', BACKGROUND_JOBS_ENABLED: 'true' }), {
    seed: true,
    backgroundJobs: true,
  });
});

test('only exact false disables startup actions', () => {
  assert.deepEqual(getStartupPolicy({ STARTUP_SEED_ENABLED: '0', BACKGROUND_JOBS_ENABLED: 'no' }), {
    seed: true,
    backgroundJobs: true,
  });
});
