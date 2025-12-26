import { expect, it, describe } from 'bun:test';
import { redis } from '../setup';

describe("Pub/Sub Operations", () => {
  it("should publish and receive a message", async () => {
    const channel = "test-channel";
    const testMessage = "Hello, Pub/Sub!";
    const receivedMessages: any[] = [];

    // Create subscriber
    const subscriber = redis.subscribe([channel]);
    
    // Set up message handler
    subscriber.on("message", (data) => {
      receivedMessages.push(data.message);
    });

    // Wait for subscription to establish
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Publish a message
    const subscriberCount = await redis.publish(channel, testMessage);
    expect(subscriberCount).toBe(1);

    // Wait for message to arrive
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify message was received
    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0]).toBe(testMessage);

    // Clean up
    await subscriber.unsubscribe();
  }, 10000);

  it("should handle multiple messages in order", async () => {
    const channel = "test-multi";
    const messages = ["First", "Second", "Third"];
    const receivedMessages: any[] = [];

    const subscriber = redis.subscribe([channel]);
    subscriber.on("message", (data) => {
      receivedMessages.push(data.message);
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Publish multiple messages
    for (const msg of messages) {
      await redis.publish(channel, msg);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(receivedMessages).toHaveLength(messages.length);
    expect(receivedMessages).toEqual(messages);

    await subscriber.unsubscribe();
  }, 10000);

  it("should handle JSON messages", async () => {
    const channel = "test-json";
    const jsonMessage = { user: "alice", action: "login", timestamp: Date.now() };
    const receivedMessages: any[] = [];

    const subscriber = redis.subscribe([channel]);
    subscriber.on("message", (data) => {
      receivedMessages.push(data.message);
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    await redis.publish(channel, jsonMessage);
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0]).toEqual(jsonMessage);

    await subscriber.unsubscribe();
  }, 10000);

  it("should handle channel-specific listeners", async () => {
    const channel = "test-specific";
    const testMessage = "Channel-specific message";
    const receivedMessages: any[] = [];

    const subscriber = redis.subscribe([channel]);
    subscriber.on(`message:${channel}`, (data) => {
      receivedMessages.push(data.message);
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    await redis.publish(channel, testMessage);
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0]).toBe(testMessage);

    await subscriber.unsubscribe();
  }, 10000);

  it("should handle multiple subscribers", async () => {
    const channel = "test-multi-sub";
    const testMessage = "Broadcast message";
    const messages1: any[] = [];
    const messages2: any[] = [];

    const subscriber1 = redis.subscribe([channel]);
    const subscriber2 = redis.subscribe([channel]);

    subscriber1.on("message", (data) => messages1.push(data.message));
    subscriber2.on("message", (data) => messages2.push(data.message));

    await new Promise((resolve) => setTimeout(resolve, 500));

    const count = await redis.publish(channel, testMessage);
    expect(count).toBe(2); // Two subscribers

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(messages1).toHaveLength(1);
    expect(messages2).toHaveLength(1);
    expect(messages1[0]).toBe(testMessage);
    expect(messages2[0]).toBe(testMessage);

    await Promise.all([subscriber1.unsubscribe(), subscriber2.unsubscribe()]);
  }, 10000);

  it("should handle unsubscribe from specific channel", async () => {
    const channel1 = "test-unsub-1";
    const channel2 = "test-unsub-2";
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

    expect(messages[channel1]).toHaveLength(1);
    expect(messages[channel2]).toHaveLength(1);

    // Unsubscribe from channel1
    await subscriber.unsubscribe([channel1]);
    
    // Clear messages
    messages[channel1] = [];
    messages[channel2] = [];

    // Send more messages
    await redis.publish(channel1, "msg3");
    await redis.publish(channel2, "msg4");
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Only channel2 should have received the message
    expect(messages[channel1]).toHaveLength(0);
    expect(messages[channel2]).toHaveLength(1);
    expect(messages[channel2][0]).toBe("msg4");

    await subscriber.unsubscribe();
  }, 10000);
});

