import { Redis } from '@upstash/redis'

const token = process.env.SR_TOKEN
const url = process.env.SR_URL

export const redis = new Redis({
  url: url,
  token: token,
})

export const cleanup = async () => {
  await redis.flushall()
}

