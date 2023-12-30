import { Redis, RedisOptions } from 'ioredis'

export type CacheConfig = {
	redisConnection?: Redis
	redisUrl?: string
	redisConfig?: RedisOptions
	cacheNamespace?: string
	defaultExpiresIn?: number
	enableDebug?: boolean
}
