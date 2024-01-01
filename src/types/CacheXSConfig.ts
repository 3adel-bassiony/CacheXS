import { Redis, RedisOptions } from 'ioredis'

export type CacheXSConfig = {
	redisConnection?: Redis
	redisUrl?: string
	redisConfig?: RedisOptions
	namespace?: string
	expiresIn?: number
	enableDebug?: boolean
}
