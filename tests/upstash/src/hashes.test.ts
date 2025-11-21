import { expect, it, describe, beforeEach } from 'bun:test';
import { redis, cleanup } from '../setup';

beforeEach(cleanup)

describe("Hash Operations", () => {
  it("should set and get hash fields", async () => {
    await redis.del("myhash");
    await redis.hset("myhash", { field1: "value1", field2: "value2" });
    const hashValue = await redis.hget("myhash", "field1");
    expect(hashValue).toBe("value1");
  });

  it("should get all hash fields and values", async () => {
    await redis.del("myhash");
    await redis.hset("myhash", { name: "Alice", age: 30, email: "alice@example.com" });
    const all = await redis.hgetall("myhash");
    expect(all).toEqual({ name: "Alice", age: 30, email: "alice@example.com" });
  });

  it("should get multiple hash fields", async () => {
    await redis.del("myhash");
    await redis.hset("myhash", { field1: "value1", field2: "value2", field3: "value3" });
    const values = await redis.hmget("myhash", "field1", "field2");
    if (values && typeof values === "object" && !Array.isArray(values)) {
      expect(values.field1).toBe("value1");
      expect(values.field2).toBe("value2");
    } else {
      // If it returns an array, check that way
      expect((values as unknown as string[])).toEqual(["value1", "value2"]);
    }
  });

  it("should check if hash field exists", async () => {
    await redis.del("myhash");
    await redis.hset("myhash", { field1: "value1" });
    const exists1 = await redis.hexists("myhash", "field1");
    const exists2 = await redis.hexists("myhash", "field2");
    expect(exists1).toBe(1);
    expect(exists2).toBe(0);
  });

  it("should delete hash fields", async () => {
    await redis.del("myhash");
    await redis.hset("myhash", { field1: "value1", field2: "value2", field3: "value3" });
    const deleted = await redis.hdel("myhash", "field1", "field2");
    expect(deleted).toBeGreaterThanOrEqual(1);
    const all = await redis.hgetall("myhash");
    expect(all).toEqual({ field3: "value3" });
  });

  it("should get all hash keys", async () => {
    await redis.del("myhash");
    await redis.hset("myhash", { field1: "value1", field2: "value2" });
    const keys = await redis.hkeys("myhash");
    expect((keys as string[]).sort()).toEqual(["field1", "field2"]);
  });

  it("should get all hash values", async () => {
    await redis.del("myhash");
    await redis.hset("myhash", { field1: "value1", field2: "value2" });
    const values = await redis.hvals("myhash");
    expect((values as string[]).sort()).toEqual(["value1", "value2"]);
  });

  it("should get hash length", async () => {
    await redis.del("myhash");
    await redis.hset("myhash", { field1: "value1", field2: "value2", field3: "value3" });
    const length = await redis.hlen("myhash");
    expect(length).toBe(3);
  });

  it("should increment hash field", async () => {
    await redis.del("myhash");
    await redis.hset("myhash", { counter: "10" });
    const newValue = await redis.hincrby("myhash", "counter", 5);
    expect(newValue).toBe(15);
  });

  it("should increment hash field by float", async () => {
    await redis.del("myhash");
    await redis.hset("myhash", { balance: "10.5" });
    const newValue = await redis.hincrbyfloat("myhash", "balance", 2.3);
    const numValue = typeof newValue === "string" ? parseFloat(newValue) : newValue;
    expect(numValue).toBeCloseTo(12.8, 1);
  });

  it("should get hash field string length", async () => {
    await redis.del("myhash");
    await redis.hset("myhash", { field: "Hello World" });
    const length = await redis.hstrlen("myhash", "field");
    expect(length).toBe(11);
  });
})

