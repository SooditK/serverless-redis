import { expect, it, describe, beforeEach } from 'bun:test';
import { redis, cleanup } from '../setup';

beforeEach(cleanup)

describe("Advanced Features", () => {
  it("should scan keys", async () => {
    await redis.set("scan:key1", "value1");
    await redis.set("scan:key2", "value2");
    await redis.set("scan:key3", "value3");

    // SCAN can return non-zero cursor even when all keys are returned
    // Continue scanning until cursor is "0" to get all keys
    let cursor = 0;
    const allKeys: string[] = [];

    do {
      const result = await redis.scan(cursor, { match: "scan:*", count: 10 });
      cursor = parseInt(result[0] as string, 10);
      const keys = result[1] as string[];
      allKeys.push(...keys);
    } while (cursor !== 0);

    // Verify we got all expected keys
    expect(allKeys.length).toBeGreaterThanOrEqual(3);
    expect(allKeys).toContain("scan:key1");
    expect(allKeys).toContain("scan:key2");
    expect(allKeys).toContain("scan:key3");
  });

  it("should scan hash fields", async () => {
    await redis.del("hscan:hash");
    await redis.hset("hscan:hash", {
      field1: "value1",
      field2: "value2",
      field3: "value3",
    });

    const result = await redis.hscan("hscan:hash", 0, { match: "field*", count: 10 });
    expect(result[0]).toBe("0");
    expect(result[1].length).toBeGreaterThan(0);
  });

  it("should scan set members", async () => {
    await redis.del("sscan:set");
    await redis.sadd("sscan:set", "member1", "member2", "member3");

    const result = await redis.sscan("sscan:set", 0, { match: "member*", count: 10 });
    expect(result[0]).toBe("0");
    expect(result[1].length).toBeGreaterThanOrEqual(3);
  });

  it("should scan sorted set members", async () => {
    await redis.del("zscan:zset");
    await redis.zadd("zscan:zset", { score: 100, member: "member1" });
    await redis.zadd("zscan:zset", { score: 200, member: "member2" });

    const result = await redis.zscan("zscan:zset", 0, { match: "member*", count: 10 });
    expect(result[0]).toBe("0");
    expect(result[1].length).toBeGreaterThan(0);
  });
})

