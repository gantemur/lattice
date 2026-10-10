export interface Rng {
  /** Uniform on the midpoint grid in (0, 1); excludes log(0) in Box–Muller. */
  uniform(): number;
}

export function validateSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('Seed must be an integer from 0 to 4294967295.');
  }
}

/** Mulberry32, version 1: uint32 seed, midpoint conversion, one word per call. */
export function createRng(seed: number): Rng {
  validateSeed(seed);
  let state = seed >>> 0;
  return {
    uniform() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return (((value ^ (value >>> 14)) >>> 0) + 0.5) / 4294967296;
    },
  };
}
