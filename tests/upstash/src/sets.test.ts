import { expect, it, describe, beforeEach } from 'bun:test';
import { redis, cleanup } from '../setup';

beforeEach(cleanup)

describe("Set Operations", () => {
  it("should add and get set members", async () => {
    await redis.del("myset");
    await redis.sadd("myset", "member1", "member2", "member3");
    const members = await redis.smembers("myset");
    expect(members.sort()).toEqual(["member1", "member2", "member3"]);
  });

  it("should check if member exists in set", async () => {
    await redis.del("myset");
    await redis.sadd("myset", "member1", "member2");
    const exists1 = await redis.sismember("myset", "member1");
    const exists2 = await redis.sismember("myset", "member3");
    expect(exists1).toBe(1);
    expect(exists2).toBe(0);
  });

  it("should get set cardinality", async () => {
    await redis.del("myset");
    await redis.sadd("myset", "member1", "member2", "member3");
    const count = await redis.scard("myset");
    expect(count).toBe(3);
  });

  it("should remove set members", async () => {
    await redis.del("myset");
    await redis.sadd("myset", "member1", "member2", "member3");
    const removed = await redis.srem("myset", "member1", "member2");
    expect(removed).toBe(2);
    const members = await redis.smembers("myset");
    expect(members).toEqual(["member3"]);
  });

  it("should pop random member from set", async () => {
    await redis.del("myset");
    await redis.sadd("myset", "member1", "member2", "member3");
    const popped = await redis.spop("myset", 1);
    expect(popped).toBeInstanceOf(Array);
    expect((popped as string[]).length).toBe(1);
    const members = await redis.smembers("myset");
    expect(members.length).toBe(2);
  });

  it("should get random member without removing", async () => {
    await redis.del("myset");
    await redis.sadd("myset", "member1", "member2", "member3");
    const random = await redis.srandmember("myset", 1);
    expect(random).toBeInstanceOf(Array);
    expect((random as string[]).length).toBe(1);
    const members = await redis.smembers("myset");
    expect(members.length).toBe(3);
  });

  it("should move member between sets", async () => {
    await redis.del("set1", "set2");
    await redis.sadd("set1", "member1", "member2");
    const moved = await redis.smove("set1", "set2", "member1");
    expect(moved).toBe(1);
    const set1Members = await redis.smembers("set1");
    const set2Members = await redis.smembers("set2");
    expect(set1Members).toEqual(["member2"]);
    expect(set2Members).toEqual(["member1"]);
  });

  it("should get union of sets", async () => {
    await redis.del("set1", "set2");
    await redis.sadd("set1", "a", "b", "c");
    await redis.sadd("set2", "c", "d", "e");
    const union = await redis.sunion("set1", "set2");
    expect(union.sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("should get intersection of sets", async () => {
    await redis.del("set1", "set2");
    await redis.sadd("set1", "a", "b", "c");
    await redis.sadd("set2", "c", "d", "e");
    const intersection = await redis.sinter("set1", "set2");
    expect(intersection).toEqual(["c"]);
  });

  it("should get difference of sets", async () => {
    await redis.del("set1", "set2");
    await redis.sadd("set1", "a", "b", "c");
    await redis.sadd("set2", "c", "d", "e");
    const diff = await redis.sdiff("set1", "set2");
    expect(diff.sort()).toEqual(["a", "b"]);
  });

  it("should store union of sets", async () => {
    await redis.del("set1", "set2", "dest");
    await redis.sadd("set1", "a", "b", "c");
    await redis.sadd("set2", "c", "d", "e");
    const count = await redis.sunionstore("dest", "set1", "set2");
    expect(count).toBe(5);
    const destMembers = await redis.smembers("dest");
    expect(destMembers.sort()).toEqual(["a", "b", "c", "d", "e"]);
  });
})

