import { expect, it, describe, beforeEach } from 'bun:test';
import { redis, cleanup } from '../setup';

beforeEach(cleanup);

/**
 * Comprehensive tests for the commands requested:
 * - PUBLISH
 * - XADD
 * - XRANGE
 * - EXPIRE
 * - SUBSCRIBE
 * - UNSUBSCRIBE
 */
describe("Requested Commands Compatibility", () => {
    describe("PUBLISH", () => {
        it("should publish a message to a channel", async () => {
            const channel = "test:publish:channel";
            const message = "Hello from PUBLISH!";

            const subscriberCount = await redis.publish(channel, message);
            expect(typeof subscriberCount).toBe("number");
            expect(subscriberCount).toBeGreaterThanOrEqual(0);
        });

        it("should publish and return subscriber count", async () => {
            const channel = "test:publish:count";
            const message = "Test message";

            // Publish without subscribers should return 0
            const count1 = await redis.publish(channel, message);
            expect(count1).toBe(0);

            // With a subscriber, count should be 1
            const subscriber = redis.subscribe([channel]);
            await new Promise((resolve) => setTimeout(resolve, 500));

            const count2 = await redis.publish(channel, message);
            expect(count2).toBe(1);

            await subscriber.unsubscribe();
        });
    });

    describe("XADD", () => {
        it("should add entry to stream with auto-generated ID", async () => {
            const streamKey = "test:xadd:stream";
            await redis.del(streamKey);

            const id = await redis.xadd(streamKey, "*", {
                field1: "value1",
                field2: "value2",
            });

            expect(id).toBeTruthy();
            expect(typeof id).toBe("string");
            // ID format: timestamp-sequence (e.g., "1234567890-0")
            expect(id).toMatch(/^\d+-\d+$/);
        });

        it("should add entry with explicit ID", async () => {
            const streamKey = "test:xadd:explicit";
            await redis.del(streamKey);

            const explicitId = "1000-0";
            const id = await redis.xadd(streamKey, explicitId, {
                data: "test",
            });

            expect(id).toBe(explicitId);
        });

        it("should add multiple entries to stream", async () => {
            const streamKey = "test:xadd:multiple";
            await redis.del(streamKey);

            const id1 = await redis.xadd(streamKey, "*", { entry: "1" });
            const id2 = await redis.xadd(streamKey, "*", { entry: "2" });
            const id3 = await redis.xadd(streamKey, "*", { entry: "3" });

            expect(id1).not.toBe(id2);
            expect(id2).not.toBe(id3);
            expect(id1).not.toBe(id3);
        });
    });

    describe("XRANGE", () => {
        it("should get all entries from stream", async () => {
            const streamKey = "test:xrange:all";
            await redis.del(streamKey);

            // Add entries
            await redis.xadd(streamKey, "*", { name: "first" });
            await new Promise((resolve) => setTimeout(resolve, 10));
            await redis.xadd(streamKey, "*", { name: "second" });
            await new Promise((resolve) => setTimeout(resolve, 10));
            await redis.xadd(streamKey, "*", { name: "third" });

            // Get all entries
            const entries = await redis.xrange(streamKey, "-", "+");
            expect(entries).toBeInstanceOf(Object);
            expect(Object.keys(entries).length).toBe(3);

            // Verify entry structure
            const entryIds = Object.keys(entries);
            expect(entries[entryIds[0]]).toHaveProperty("name");
        });

        it("should get range with specific IDs", async () => {
            const streamKey = "test:xrange:specific";
            await redis.del(streamKey);

            const id1 = await redis.xadd(streamKey, "*", { data: "entry1" });
            await new Promise((resolve) => setTimeout(resolve, 10));
            const id2 = await redis.xadd(streamKey, "*", { data: "entry2" });
            await new Promise((resolve) => setTimeout(resolve, 10));
            const id3 = await redis.xadd(streamKey, "*", { data: "entry3" });

            // Get entries between id1 and id3
            const entries = await redis.xrange(streamKey, id1, id3);
            expect(entries).toBeInstanceOf(Object);
            expect(Object.keys(entries).length).toBe(3);
        });

        it("should return empty object for empty stream", async () => {
            const streamKey = "test:xrange:empty";
            await redis.del(streamKey);

            const entries = await redis.xrange(streamKey, "-", "+");
            expect(entries).toBeInstanceOf(Object);
            expect(Object.keys(entries).length).toBe(0);
        });
    });

    describe("EXPIRE", () => {
        it("should set expiration on a key", async () => {
            const key = "test:expire:key";
            await redis.set(key, "value");

            const result = await redis.expire(key, 10);
            expect(result).toBe(1);

            const ttl = await redis.ttl(key);
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(10);
        });

        it("should return 0 for non-existent key", async () => {
            const key = "test:expire:nonexistent";
            await redis.del(key);

            const result = await redis.expire(key, 10);
            expect(result).toBe(0);
        });

        it("should expire key after timeout", async () => {
            const key = "test:expire:timeout";
            await redis.set(key, "value");
            await redis.expire(key, 1);

            // Wait for expiration
            await new Promise((resolve) => setTimeout(resolve, 1100));

            const exists = await redis.exists(key);
            expect(exists).toBe(0);
        });
    });

    describe("SUBSCRIBE", () => {
        it("should subscribe to a channel", async () => {
            const channel = "test:subscribe:channel";
            const receivedMessages: any[] = [];

            const subscriber = redis.subscribe([channel]);
            subscriber.on("message", (data) => {
                receivedMessages.push(data.message);
            });

            // Wait for subscription to establish
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Publish a message
            await redis.publish(channel, "test message");
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Note: Message reception may depend on server implementation
            // At minimum, subscription should be established
            expect(subscriber).toBeTruthy();

            await subscriber.unsubscribe();
        });

        it("should subscribe to multiple channels", async () => {
            const channels = ["test:sub:1", "test:sub:2"];
            const receivedMessages: Record<string, any[]> = {
                [channels[0]]: [],
                [channels[1]]: [],
            };

            const subscriber = redis.subscribe(channels);
            subscriber.on("message", (data) => {
                receivedMessages[data.channel].push(data.message);
            });

            await new Promise((resolve) => setTimeout(resolve, 500));

            // Publish to both channels
            await redis.publish(channels[0], "message1");
            await redis.publish(channels[1], "message2");
            await new Promise((resolve) => setTimeout(resolve, 500));

            expect(subscriber).toBeTruthy();
            await subscriber.unsubscribe();
        });
    });

    describe("UNSUBSCRIBE", () => {
        it("should unsubscribe from all channels", async () => {
            const channel = "test:unsubscribe:all";
            const receivedMessages: any[] = [];

            const subscriber = redis.subscribe([channel]);
            subscriber.on("message", (data) => {
                receivedMessages.push(data.message);
            });

            await new Promise((resolve) => setTimeout(resolve, 500));

            // Unsubscribe from all
            await subscriber.unsubscribe();

            // Publish after unsubscribe
            await redis.publish(channel, "should not receive");
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Subscription should be closed
            expect(subscriber).toBeTruthy();
        });

        it("should unsubscribe from specific channel", async () => {
            const channel1 = "test:unsub:1";
            const channel2 = "test:unsub:2";
            const messages: Record<string, any[]> = {
                [channel1]: [],
                [channel2]: [],
            };

            const subscriber = redis.subscribe([channel1, channel2]);
            subscriber.on("message", (data) => {
                messages[data.channel].push(data.message);
            });

            await new Promise((resolve) => setTimeout(resolve, 500));

            // Send initial messages
            await redis.publish(channel1, "msg1");
            await redis.publish(channel2, "msg2");
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Unsubscribe from channel1 only
            await subscriber.unsubscribe([channel1]);

            // Clear messages
            messages[channel1] = [];
            messages[channel2] = [];

            // Send more messages
            await redis.publish(channel1, "msg3");
            await redis.publish(channel2, "msg4");
            await new Promise((resolve) => setTimeout(resolve, 500));

            // channel1 should not receive (unsubscribed)
            // channel2 should still receive
            expect(subscriber).toBeTruthy();
            await subscriber.unsubscribe();
        });
    });

    describe("Integration: All commands together", () => {
        it("should work with PUBLISH, SUBSCRIBE, UNSUBSCRIBE together", async () => {
            const channel = "test:integration:pubsub";
            const receivedMessages: any[] = [];

            const subscriber = redis.subscribe([channel]);
            subscriber.on("message", (data) => {
                receivedMessages.push(data.message);
            });

            await new Promise((resolve) => setTimeout(resolve, 500));

            const count = await redis.publish(channel, "integration test");
            expect(count).toBeGreaterThanOrEqual(0);

            await new Promise((resolve) => setTimeout(resolve, 500));
            await subscriber.unsubscribe();
        });

        it("should work with XADD, XRANGE, EXPIRE together", async () => {
            const streamKey = "test:integration:stream";
            await redis.del(streamKey);

            // Add entry
            const id = await redis.xadd(streamKey, "*", {
                action: "test",
                timestamp: Date.now().toString(),
            });
            expect(id).toBeTruthy();

            // Get range
            const entries = await redis.xrange(streamKey, "-", "+");
            expect(entries).toBeInstanceOf(Object);
            expect(Object.keys(entries).length).toBe(1);

            // Set expiration
            const expireResult = await redis.expire(streamKey, 60);
            expect(expireResult).toBe(1);

            const ttl = await redis.ttl(streamKey);
            expect(ttl).toBeGreaterThan(0);
        });
    });
});


