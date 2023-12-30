import { Redis, RedisOptions } from 'ioredis'

export type CacheXSConfig = {
	redisConnection?: Redis
	redisUrl?: string
	redisConfig?: RedisOptions
	cacheNamespace?: string
	defaultExpiresIn?: number
	enableDebug?: boolean
}
