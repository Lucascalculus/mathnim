import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { MATHIUM_VERSION } from '../src/kernel/version';

// The version a learner can read in Settings and in the page's <meta name="generator"> is this one number.
describe('version', () => {
  it('is a plain x.y.z and agrees with the package', () => {
    expect(MATHIUM_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.version).toBe(MATHIUM_VERSION);
  });
});
