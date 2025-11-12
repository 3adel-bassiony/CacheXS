import { RedisClient, RedisOptions } from 'bun'

export type CacheXSConfig = {
	redisClient?: RedisClient
	redisUrl?: string
	redisOptions?: RedisOptions
	namespace?: string
	expiresIn?: number
	enableDebug?: boolean
}
