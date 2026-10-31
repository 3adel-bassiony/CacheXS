import type { RedisClient, RedisOptions } from 'bun'

export type CacheXSConfig = {
	redisClient?: RedisClient
	redisUrl?: string
	redisOptions?: RedisOptions
	/** Replace an owned client after disconnection so the next operation can reconnect. Defaults to false. */
	recoverOnDisconnect?: boolean
	namespace?: string
	expiresIn?: number
	enableDebug?: boolean
}
