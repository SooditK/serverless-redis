import { expect, it, describe, beforeEach } from 'bun:test';
import { redis, cleanup } from '../setup';

beforeEach(cleanup)

describe("Advanced Features", () => {
  it("should scan keys", async () => {
    await redis.set("scan:key1", "value1");
    await redis.set("scan:key2", "value2");
    await redis.set("scan:key3", "value3");

    const result = await redis.scan(0, { match: "scan:*", count: 10 });
    expect(result[0]).toBe("0"); // Cursor
    expect(result[1].length).toBeGreaterThanOrEqual(3);
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

