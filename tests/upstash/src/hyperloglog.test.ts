import { expect, it, describe, beforeEach } from 'bun:test';
import { redis, cleanup } from '../setup';

beforeEach(cleanup)

describe("HyperLogLog", () => {
  it("should add to HyperLogLog", async () => {
    await redis.del("hll");
    const added = await redis.pfadd("hll", "item1", "item2", "item3");
    expect(added).toBe(1);
  });

  it("should count HyperLogLog", async () => {
    await redis.del("hll");
    await redis.pfadd("hll", "item1", "item2", "item3");
    const count = await redis.pfcount("hll");
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("should merge HyperLogLogs", async () => {
    await redis.del("hll1", "hll2", "hll:merged");
    await redis.pfadd("hll1", "item1", "item2");
    await redis.pfadd("hll2", "item2", "item3");
    const merged = await redis.pfmerge("hll:merged", "hll1", "hll2");
    expect(merged).toBe("OK");
    const count = await redis.pfcount("hll:merged");
    expect(count).toBeGreaterThanOrEqual(3);
  });
})

