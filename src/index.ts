import Redis, { RedisOptions } from 'ioredis'

import { CacheConfig } from './types/CacheConfig'
import { SetForeverOptions } from './types/SetForeverOptions'
import { SetOptions } from './types/SetOptions'

export default class Cache {
	protected _redisConnection: Redis
	protected _redisUrl: string | undefined
	protected _redisConfig: RedisOptions | undefined
	protected _cacheNamespace: string
	protected _defaultExpiresIn: number
	protected _enableDebug: boolean

	constructor({
		redisConnection,
		redisUrl,
		redisConfig,
		cacheNamespace = 'cache',
		defaultExpiresIn = 300,
		enableDebug = false,
	}: CacheConfig = {}) {
		this.configureCache({
			redisConnection,
			redisUrl,
			redisConfig,
			cacheNamespace,
			defaultExpiresIn,
			enableDebug,
		})
	}

	protected configureCache({
		redisConnection,
		redisConfig,
		redisUrl,
		cacheNamespace = 'cache',
		defaultExpiresIn = 300,
		enableDebug = false,
	}: CacheConfig) {
		if (redisConnection) {
			this._redisConnection = redisConnection
			this._redisConfig = redisConnection.options
		} else {
			if (redisUrl) {
				this._redisConnection = new Redis(redisUrl)
				this._redisUrl = redisUrl
			} else {
				const config = redisConfig ?? {
					host: 'localhost',
					port: 6379,
					password: '',
				}

				this._redisConnection = new Redis(config)
				this._redisConfig = config
			}
		}

		this._cacheNamespace = cacheNamespace
		this._defaultExpiresIn = defaultExpiresIn
		this._enableDebug = enableDebug
	}

	public configure({
		redisConnection,
		redisConfig,
		redisUrl,
		cacheNamespace = 'cache',
		defaultExpiresIn = 300,
		enableDebug = false,
	}: CacheConfig): Cache {
		this.configureCache({ redisConnection, redisConfig, redisUrl, cacheNamespace, defaultExpiresIn, enableDebug })
		return this
	}

	public concatenateKeyWithNamespace(key: string, namespace?: string): string {
		const cacheNamespace = this._cacheNamespace
		return namespace ? `${cacheNamespace}:${namespace}:${key}` : `${cacheNamespace}:${key}`
	}

	public async get<T>(key: string, namespace?: string): Promise<T | null> {
		const keyWithNamespace = this.concatenateKeyWithNamespace(key, namespace)

		const value = await this._redisConnection.get(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`Cache -> Get -> ${keyWithNamespace}: ${value}`)
		}

		if (value) {
			try {
				const parsedData = JSON.parse(value) as T
				return parsedData
			} catch {
				return value as T
			}
		}

		return null
	}

	public async set<T>(key: string, value: T, options?: SetOptions): Promise<void> {
		const namespace = options?.namespace
		const expiresIn = options?.expiresIn ?? this._defaultExpiresIn
		const keyWithNamespace = this.concatenateKeyWithNamespace(key, namespace)

		await this._redisConnection.set(keyWithNamespace, JSON.stringify(value), 'EX', expiresIn)

		if (this._enableDebug) {
			console.debug(`Cache -> Set (For: ${expiresIn} Sec.) -> ${keyWithNamespace}: ${value}`)
		}
	}

	public async setForever<T>(key: string, value: T, options?: SetForeverOptions): Promise<void> {
		const namespace = options?.namespace
		const keyWithNamespace = this.concatenateKeyWithNamespace(key, namespace)

		await this._redisConnection.set(keyWithNamespace, JSON.stringify(value))

		if (this._enableDebug) {
			console.debug(`Cache -> Set (Forever) -> ${keyWithNamespace}: ${value}`)
		}
	}

	public async getOrSet<T>(key: string, fallbackValue: T, options?: SetOptions): Promise<T> {
		const namespace = options?.namespace
		const expiresIn = options?.expiresIn ?? this._defaultExpiresIn
		const keyWithNamespace = this.concatenateKeyWithNamespace(key, namespace)

		const value = await this.get<T>(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`Cache -> Get -> ${keyWithNamespace}: ${value}`)
		}

		if (value) {
			return value
		}

		await this.set(key, fallbackValue, options)

		if (this._enableDebug) {
			console.debug(`Cache -> Set (For: ${expiresIn} Sec.) -> ${keyWithNamespace}: ${value}`)
		}

		return fallbackValue
	}

	public async getOrSetForever<T>(key: string, fallbackValue: T, options?: SetForeverOptions): Promise<T> {
		const namespace = options?.namespace
		const keyWithNamespace = this.concatenateKeyWithNamespace(key, namespace)

		const value = await this.get<T>(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`Cache -> Get -> ${keyWithNamespace}: ${value}`)
		}

		if (value) {
			return value
		}

		await this.set(key, fallbackValue)

		if (this._enableDebug) {
			console.debug(`Cache -> Set (Forever) -> ${keyWithNamespace}: ${value}`)
		}
		return fallbackValue
	}

	public async delete(key: string, namespace?: string): Promise<void> {
		const keyWithNamespace = this.concatenateKeyWithNamespace(key, namespace)

		await this._redisConnection.del(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`Cache -> Delete -> ${key}`)
		}
	}

	public async deleteAll(): Promise<void> {
		const keys = await this._redisConnection.keys(`${this._cacheNamespace}:*`)

		await this._redisConnection.del(keys)

		if (this._enableDebug) {
			console.debug('Cache -> Delete All')
		}
	}

	public get redisUrl(): string | undefined {
		return this._redisUrl
	}

	public get redisConfig(): RedisOptions | undefined {
		return this._redisConfig
	}

	public get defaultExpiresIn(): number {
		return this._defaultExpiresIn
	}

	public get cacheNamespace(): string {
		return this._cacheNamespace
	}

	public get isDebugEnabled(): boolean {
		return this._enableDebug
	}
}
