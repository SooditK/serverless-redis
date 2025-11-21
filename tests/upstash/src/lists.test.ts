import { expect, it, describe, beforeEach } from 'bun:test';
import { redis, cleanup } from '../setup';

beforeEach(cleanup)

describe("List Operations", () => {
  it("should push and pop from left", async () => {
    await redis.del("mylist");
    await redis.lpush("mylist", "world");
    await redis.lpush("mylist", "hello");
    const listData = await redis.lrange("mylist", 0, -1);
    expect(listData).toEqual(["hello", "world"]);
    const popped = await redis.lpop("mylist");
    expect(popped).toBe("hello");
  });

  it("should push and pop from right", async () => {
    await redis.del("mylist");
    await redis.rpush("mylist", "hello");
    await redis.rpush("mylist", "world");
    const listData = await redis.lrange("mylist", 0, -1);
    expect(listData).toEqual(["hello", "world"]);
    const popped = await redis.rpop("mylist");
    expect(popped).toBe("world");
  });

  it("should get list length", async () => {
    await redis.del("mylist");
    await redis.lpush("mylist", "a", "b", "c");
    const length = await redis.llen("mylist");
    expect(length).toBe(3);
  });

  it("should get element by index", async () => {
    await redis.del("mylist");
    await redis.lpush("mylist", "a", "b", "c");
    const element = await redis.lindex("mylist", 1);
    expect(element).toBe("b");
  });

  it("should set element by index", async () => {
    await redis.del("mylist");
    await redis.lpush("mylist", "a", "b", "c");
    await redis.lset("mylist", 1, "x");
    const element = await redis.lindex("mylist", 1);
    expect(element).toBe("x");
  });

  it("should remove elements by value", async () => {
    await redis.del("mylist");
    await redis.lpush("mylist", "a", "b", "a", "c", "a");
    const removed = await redis.lrem("mylist", 2, "a");
    expect(removed).toBe(2);
    const list = await redis.lrange("mylist", 0, -1);
    expect(list).toContain("a");
  });

  it("should trim list", async () => {
    await redis.del("mylist");
    await redis.lpush("mylist", "a", "b", "c", "d", "e");
    await redis.ltrim("mylist", 0, 2);
    const list = await redis.lrange("mylist", 0, -1);
    expect(list.length).toBe(3);
  });

  it("should move element between lists", async () => {
    await redis.del("source", "dest");
    await redis.lpush("source", "item1", "item2");
    const moved = await redis.lmove("source", "dest", "left", "right");
    expect(moved).toBe("item2");
    const sourceList = await redis.lrange("source", 0, -1);
    const destList = await redis.lrange("dest", 0, -1);
    expect(sourceList).toEqual(["item1"]);
    expect(destList).toEqual(["item2"]);
  });

  it("should insert element before pivot", async () => {
    await redis.del("mylist");
    await redis.lpush("mylist", "a", "b", "c");
    await redis.linsert("mylist", "before", "b", "x");
    const list = await redis.lrange("mylist", 0, -1);
    expect(list).toEqual(["c", "x", "b", "a"]);
  });

  it("should find position of element", async () => {
    await redis.del("mylist");
    await redis.lpush("mylist", "a", "b", "a", "c");
    const position = await redis.lpos("mylist", "a");
    expect(position).toBe(1); 
  });
})

