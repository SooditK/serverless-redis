import { expect, it, describe, beforeEach } from "bun:test";
import { redis, cleanup } from "../setup";

beforeEach(cleanup);

describe("Lua Script Commands", () => {
  it("should eval a simple script with args", async () => {
    const script = `
      return ARGV[1]
    `;
    const result = await redis.eval(script, [], ["hello"]);
    expect(result).toBe("hello");
  });

  it("should eval a script that reads a key", async () => {
    const key = "script:key:get";
    await redis.set(key, "value");

    const script = `
      local value = redis.call('GET', KEYS[1])
      return value
    `;
    const result = await redis.eval(script, [key], []);
    expect(result).toBe("value");
  });

  it("should evalRo a read-only script", async () => {
    const key = "script:key:readonly";
    await redis.set(key, "readonly");

    const script = `
      return redis.call('GET', KEYS[1])
    `;
    const result = await redis.evalRo(script, [key], []);
    expect(result).toBe("readonly");
  });
});

describe("Script Cache Commands", () => {
  const script = `
    return ARGV[1]
  `;

  it("should scriptLoad and evalsha", async () => {
    const sha = await redis.scriptLoad(script);
    expect(typeof sha).toBe("string");
    expect(sha.length).toBeGreaterThan(0);

    const result = await redis.evalsha(sha, [], ["hello"]);
    expect(result).toBe("hello");
  });

  it("should evalshaRo with a loaded script", async () => {
    const sha = await redis.scriptLoad(script);
    const result = await redis.evalshaRo(sha, [], ["ro"]);
    expect(result).toBe("ro");
  });

  it("should scriptExists return correct flags", async () => {
    const sha = await redis.scriptLoad(script);
    const results = await redis.scriptExists(sha, "deadbeef");

    expect(Array.isArray(results)).toBe(true);
    expect(Number(results[0])).toBe(1);
    expect(Number(results[1])).toBe(0);
  });

  it("should scriptFlush remove cached scripts", async () => {
    const sha = await redis.scriptLoad(script);
    const flushResult = await redis.scriptFlush();

    if (typeof flushResult === "string") {
      expect(flushResult.toUpperCase()).toBe("OK");
    } else {
      expect(flushResult).toBeTruthy();
    }

    const results = await redis.scriptExists(sha);
    expect(Number(results[0])).toBe(0);
  });
});
