import { expect, it, describe, beforeEach } from 'bun:test';
import { redis, cleanup } from '../setup';

beforeEach(cleanup)

describe("Bitmaps", () => {
  it("should set and get bit", async () => {
    await redis.del("bitmap");
    const oldValue = await redis.setbit("bitmap", 7, 1);
    expect(oldValue).toBe(0);
    const bit = await redis.getbit("bitmap", 7);
    expect(bit).toBe(1);
  });

  it("should count set bits", async () => {
    await redis.del("bitmap");
    await redis.setbit("bitmap", 0, 1);
    await redis.setbit("bitmap", 1, 1);
    await redis.setbit("bitmap", 2, 1);
    const count = await redis.bitcount("bitmap", 0, -1);
    expect(count).toBe(3);
  });

  it("should perform bitwise operations", async () => {
    await redis.del("bitmap1", "bitmap2", "bitmap:and");
    await redis.setbit("bitmap1", 0, 1);
    await redis.setbit("bitmap1", 1, 1);
    await redis.setbit("bitmap2", 1, 1);
    await redis.setbit("bitmap2", 2, 1);
    const result = await redis.bitop("and", "bitmap:and", "bitmap1", "bitmap2");
    expect(result).toBe(1);
    const count = await redis.bitcount("bitmap:and", 0, -1);
    expect(count).toBe(1);
  });
})

