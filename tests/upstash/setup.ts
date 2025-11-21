import { Redis } from '@upstash/redis'

const token = process.env.SR_TOKEN
const url = process.env.SR_URL

export const redis = new Redis({
  url: url,
  token: token,
})

export const cleanup = async () => {
  const testKeys = [
    "foo", "counter", "mylist", "myhash", "expirekey", "persistkey", "ttlkey",
    "test:*", "user:*", "stats:*", "scores:*", "animals:*", "existskey", "delkey*",
    "set:*", "zset:*", "bitmap:*", "geo:*", "stream:*", "nxkey", "xxkey",
    "key*", "lock:*", "appendkey", "strlenkey", "substrkey", "setrangekey",
    "floatcounter", "source", "dest", "stringkey", "listkey", "setkey", "oldkey*", "newkey*",
    "account:*", "txkey", "pipeline:*", "bitmap*", "hll*", "scan:*", "hscan:*", "sscan:*", "zscan:*"
  ]
  for (const pattern of testKeys) {
    if (pattern.includes("*")) {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } else {
      await redis.del(pattern)
    }
  }
}

