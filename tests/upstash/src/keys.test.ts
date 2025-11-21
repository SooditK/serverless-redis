import { expect, it, describe, beforeEach } from 'bun:test';
import { redis, cleanup } from '../setup';

beforeEach(cleanup)

describe("Key Operations", () => {
  it("should check if key exists", async () => {
    await redis.set("existskey", "value");
    const exists1 = await redis.exists("existskey");
    const exists2 = await redis.exists("nonexistent");
    expect(exists1).toBe(1);
    expect(exists2).toBe(0);
  });

  it("should delete keys", async () => {
    await redis.set("delkey1", "value1");
    await redis.set("delkey2", "value2");
    const deleted = await redis.del("delkey1", "delkey2");
    expect(deleted).toBe(2);
  });

  it("should set expiration", async () => {
    await redis.set("expirekey", "value");
    await redis.expire("expirekey", 10);
    const ttl = await redis.ttl("expirekey");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10);
  });

  it("should set expiration in milliseconds", async () => {
    await redis.set("pexpirekey", "value");
    await redis.pexpire("pexpirekey", 10000);
    const pttl = await redis.pttl("pexpirekey");
    expect(pttl).toBeGreaterThan(0);
    expect(pttl).toBeLessThanOrEqual(10000);
  });

  it("should persist key", async () => {
    await redis.set("persistkey", "value", { ex: 10 });
    const persisted = await redis.persist("persistkey");
    expect(persisted).toBe(1);
    const ttl = await redis.ttl("persistkey");
    expect(ttl).toBe(-1);
  });

  it("should get TTL", async () => {
    await redis.set("ttlkey", "value", { ex: 10 });
    const ttl = await redis.ttl("ttlkey");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10);
  });

  it("should get type of key", async () => {
    await redis.set("stringkey", "value");
    await redis.lpush("listkey", "value");
    await redis.sadd("setkey", "value");
    const stringType = await redis.type("stringkey");
    const listType = await redis.type("listkey");
    const setType = await redis.type("setkey");
    expect(stringType).toBe("string");
    expect(listType).toBe("list");
    expect(setType).toBe("set");
  });

  it("should rename key", async () => {
    await redis.set("oldkey", "value");
    await redis.rename("oldkey", "newkey");
    const value = await redis.get("newkey");
    expect(value).toBe("value");
    const oldExists = await redis.exists("oldkey");
    expect(oldExists).toBe(0);
  });

  it("should rename key only if new doesn't exist", async () => {
    await redis.del("oldkey", "newkey");
    await redis.set("oldkey", "value");
    const result = await redis.renamenx("oldkey", "newkey");
    expect(result).toBe(1);
    await redis.set("oldkey2", "value2");
    await redis.set("newkey2", "value3");
    const result2 = await redis.renamenx("oldkey2", "newkey2");
    expect(result2).toBe(0);
  });

  it("should get random key", async () => {
    await redis.set("key1", "value1");
    await redis.set("key2", "value2");
    const random = await redis.randomkey();
    expect(random).toBeTruthy();
  });
})

