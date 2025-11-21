import { expect, it, describe, beforeEach } from 'bun:test';
import { redis, cleanup } from '../setup';

beforeEach(cleanup)

describe("String Operations", () => {
  it("should set and get a key", async () => {
    const setResult = await redis.set("foo", "bar");
    expect(setResult).toBe("OK");
    const data = await redis.get("foo");
    expect(data).toBe("bar");
  });

  it("should set with expiration", async () => {
    await redis.set("expirekey", "value", { ex: 10 });
    const ttl = await redis.ttl("expirekey");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10);
  });

  it("should set with NX (only if not exists)", async () => {
    await redis.del("nxkey");
    const result1 = await redis.set("nxkey", "value", { nx: true });
    expect(result1).toBe("OK");
    const result2 = await redis.set("nxkey", "value2", { nx: true });
    expect(result2).toBeNull();
    const value = await redis.get("nxkey");
    expect(value).toBe("value");
  });

  it("should set with XX (only if exists)", async () => {
    await redis.del("xxkey");
    const result1 = await redis.set("xxkey", "value", { xx: true });
    expect(result1).toBeNull();
    await redis.set("xxkey", "value");
    const result2 = await redis.set("xxkey", "value2", { xx: true });
    expect(result2).toBe("OK");
  });

  it("should set multiple keys with mset", async () => {
    await redis.mset({
      "user:1:name": "Alice",
      "user:1:email": "alice@example.com",
      "user:1:age": "30",
    });
    const name = await redis.get("user:1:name");
    const email = await redis.get("user:1:email");
    expect(name).toBe("Alice");
    expect(email).toBe("alice@example.com");
  });

  it("should get multiple keys with mget", async () => {
    await redis.set("key1", "value1");
    await redis.set("key2", "value2");
    await redis.set("key3", "value3");
    const values = await redis.mget("key1", "key2", "key3");
    expect(values).toEqual(["value1", "value2", "value3"]);
  });

  it("should set multiple keys only if none exist with msetnx", async () => {
    await redis.del("lock:a", "lock:b");
    const result1 = await redis.msetnx({
      "lock:a": "1",
      "lock:b": "1",
    });
    expect(result1).toBe(1);
    const result2 = await redis.msetnx({
      "lock:a": "2",
      "lock:c": "1",
    });
    expect(result2).toBe(0);
  });

  it("should append to a string", async () => {
    await redis.set("appendkey", "Hello");
    const length = await redis.append("appendkey", " World");
    expect(length).toBe(11);
    const value = await redis.get("appendkey");
    expect(value).toBe("Hello World");
  });

  it("should get string length", async () => {
    await redis.set("strlenkey", "Hello World");
    const length = await redis.strlen("strlenkey");
    expect(length).toBe(11);
  });

  it("should get substring", async () => {
    await redis.set("substrkey", "Hello World");
    const substr = await redis.getrange("substrkey", 0, 4);
    expect(substr).toBe("Hello");
  });

  it("should set substring", async () => {
    await redis.set("setrangekey", "Hello World");
    const length = await redis.setrange("setrangekey", 6, "Redis");
    expect(length).toBe(11);
    const value = await redis.get("setrangekey");
    expect(value).toBe("Hello Redis");
  });

  it("should increment and decrement a key", async () => {
    await redis.set("counter", "0");
    const incrResult = await redis.incr("counter");
    expect(incrResult).toBe(1);
    const decrResult = await redis.decr("counter");
    expect(decrResult).toBe(0);
  });

  it("should increment by specific amount", async () => {
    await redis.set("counter", "10");
    const result = await redis.incrby("counter", 5);
    expect(result).toBe(15);
    const result2 = await redis.decrby("counter", 3);
    expect(result2).toBe(12);
  });

  it("should increment by float", async () => {
    await redis.set("floatcounter", "10.5");
    const result = await redis.incrbyfloat("floatcounter", 2.3);
    const numResult = typeof result === "string" ? parseFloat(result) : result;
    expect(numResult).toBeCloseTo(12.8, 1);
  });
})

