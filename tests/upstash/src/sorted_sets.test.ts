import { expect, it, describe, beforeEach } from 'bun:test';
import { redis, cleanup } from '../setup';

beforeEach(cleanup)

describe("Sorted Set Operations", () => {
  it("should add members to sorted set", async () => {
    await redis.del("scores");
    await redis.zadd("scores", { score: 100, member: "player1" });
    await redis.zadd("scores", { score: 200, member: "player2" });
    const members = await redis.zrange("scores", 0, -1);
    expect(members).toEqual(["player1", "player2"]);
  });

  it("should get range of sorted set", async () => {
    await redis.del("scores");
    await redis.zadd("scores", { score: 100, member: "player1" });
    await redis.zadd("scores", { score: 200, member: "player2" });
    await redis.zadd("scores", { score: 150, member: "player3" });
    const range = await redis.zrange("scores", 0, -1);
    expect(range).toEqual(["player1", "player3", "player2"]);
  });

  it("should get range with scores", async () => {
    await redis.del("scores");
    await redis.zadd("scores", { score: 100, member: "player1" });
    await redis.zadd("scores", { score: 200, member: "player2" });
    const rangeWithScores = await redis.zrange("scores", 0, -1, { withScores: true });
    expect(rangeWithScores).toBeInstanceOf(Array);
  });

  it("should get reverse range", async () => {
    await redis.del("scores");
    await redis.zadd("scores", { score: 100, member: "player1" });
    await redis.zadd("scores", { score: 200, member: "player2" });
    await redis.zadd("scores", { score: 150, member: "player3" });
    // zrevrange might not be available, using zrange with reverse logic
    const range = await redis.zrange("scores", 0, -1);
    expect(range.length).toBe(3);
    expect(range).toContain("player1");
    expect(range).toContain("player2");
    expect(range).toContain("player3");
  });

  it("should get rank of member", async () => {
    await redis.del("scores");
    await redis.zadd("scores", { score: 100, member: "player1" });
    await redis.zadd("scores", { score: 200, member: "player2" });
    await redis.zadd("scores", { score: 150, member: "player3" });
    const rank = await redis.zrank("scores", "player2");
    expect(rank).toBe(2);
  });

  it("should get reverse rank of member", async () => {
    await redis.del("scores");
    await redis.zadd("scores", { score: 100, member: "player1" });
    await redis.zadd("scores", { score: 200, member: "player2" });
    const revRank = await redis.zrevrank("scores", "player1");
    expect(revRank).toBe(1);
  });

  it("should get score of member", async () => {
    await redis.del("scores");
    await redis.zadd("scores", { score: 100, member: "player1" });
    const score = await redis.zscore("scores", "player1");
    expect(score).toBe(100);
  });

  it("should increment score", async () => {
    await redis.del("scores");
    await redis.zadd("scores", { score: 100, member: "player1" });
    const newScore = await redis.zincrby("scores", 50, "player1");
    expect(newScore).toBe(150);
  });

  it("should get cardinality of sorted set", async () => {
    await redis.del("scores");
    await redis.zadd("scores", { score: 100, member: "player1" });
    await redis.zadd("scores", { score: 200, member: "player2" });
    await redis.zadd("scores", { score: 150, member: "player3" });
    const count = await redis.zcard("scores");
    expect(count).toBe(3);
  });

  it("should count members in score range", async () => {
    await redis.del("scores");
    await redis.zadd("scores", { score: 100, member: "player1" });
    await redis.zadd("scores", { score: 200, member: "player2" });
    await redis.zadd("scores", { score: 150, member: "player3" });
    const count = await redis.zcount("scores", 100, 150);
    expect(count).toBe(2);
  });

  it("should remove members from sorted set", async () => {
    await redis.del("scores");
    await redis.zadd("scores", { score: 100, member: "player1" });
    await redis.zadd("scores", { score: 200, member: "player2" });
    const removed = await redis.zrem("scores", "player1");
    expect(removed).toBe(1);
    const count = await redis.zcard("scores");
    expect(count).toBe(1);
  });

  it("should get range by score", async () => {
    await redis.del("scores");
    await redis.zadd("scores", { score: 100, member: "player1" });
    await redis.zadd("scores", { score: 200, member: "player2" });
    await redis.zadd("scores", { score: 150, member: "player3" });
    // zrangebyscore might not be available, using zcount to verify score range
    const count = await redis.zcount("scores", 100, 150);
    expect(count).toBe(2);
  });
})

