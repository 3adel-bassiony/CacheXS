import type { RedisClient, RedisOptions } from 'bun'

export type CacheXSConfig = {
	redisClient?: RedisClient
	redisUrl?: string
	redisOptions?: RedisOptions
	recoverOnDisconnect?: boolean
	namespace?: string
	expiresIn?: number
	enableDebug?: boolean
}
