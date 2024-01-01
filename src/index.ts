import Redis, { RedisOptions } from 'ioredis'

import { CacheXSConfig } from './types/CacheXSConfig'
import { SetOptions } from './types/SetOptions'

export default class CacheXS {
	protected _redisConnection: Redis
	protected _redisUrl: string | undefined
	protected _redisConfig: RedisOptions | undefined
	protected _namespace: string
	protected _expiresIn: number
	protected _enableDebug: boolean

	constructor({
		redisConnection,
		redisUrl,
		redisConfig,
		namespace = 'cachexs',
		expiresIn = 300,
		enableDebug = false,
	}: CacheXSConfig = {}) {
		this.configureCacheXS({
			redisConnection,
			redisUrl,
			redisConfig,
			namespace,
			expiresIn,
			enableDebug,
		})
	}

	protected configureCacheXS({
		redisConnection,
		redisConfig,
		redisUrl,
		namespace = 'cachexs',
		expiresIn = 300,
		enableDebug = false,
	}: CacheXSConfig) {
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

		this._namespace = namespace
		this._expiresIn = expiresIn
		this._enableDebug = enableDebug
	}

	public configure({
		redisConnection,
		redisConfig,
		redisUrl,
		namespace = 'cachexs',
		expiresIn = 300,
		enableDebug = false,
	}: CacheXSConfig): CacheXS {
		this.configureCacheXS({ redisConnection, redisConfig, redisUrl, namespace, expiresIn, enableDebug })
		return this
	}

	public concatenateKey(key: string): string {
		const namespace = this._namespace
		return namespace.length > 0 ? `${namespace}:${key}` : key
	}

	public async get<T>(key: string): Promise<T | null> {
		const keyWithNamespace = this.concatenateKey(key)

		const value = await this._redisConnection.get(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Get -> ${keyWithNamespace}: ${value}`)
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
		const expiresIn = options?.expiresIn ?? this._expiresIn
		const keyWithNamespace = this.concatenateKey(key)
		const parsedValue = typeof value === 'object' ? JSON.stringify(value) : (value as string | number | Buffer)

		await this._redisConnection.set(keyWithNamespace, parsedValue, 'EX', expiresIn)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Set (For: ${expiresIn} Sec.) -> ${keyWithNamespace}: ${value}`)
		}
	}

	public async setForever<T>(key: string, value: T): Promise<void> {
		const keyWithNamespace = this.concatenateKey(key)

		await this._redisConnection.set(keyWithNamespace, JSON.stringify(value))

		if (this._enableDebug) {
			console.debug(`CacheXS -> Set (Forever) -> ${keyWithNamespace}: ${value}`)
		}
	}

	public async getOrSet<T>(key: string, fallbackValue: T, options?: SetOptions): Promise<T> {
		const expiresIn = options?.expiresIn ?? this._expiresIn
		const keyWithNamespace = this.concatenateKey(key)

		const value = await this.get<T>(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Get -> ${keyWithNamespace}: ${value}`)
		}

		if (value) {
			return value
		}

		await this.set(key, fallbackValue, options)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Set (For: ${expiresIn} Sec.) -> ${keyWithNamespace}: ${value}`)
		}

		return fallbackValue
	}

	public async getOrSetForever<T>(key: string, fallbackValue: T): Promise<T> {
		const keyWithNamespace = this.concatenateKey(key)

		const value = await this.get<T>(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Get -> ${keyWithNamespace}: ${value}`)
		}

		if (value) {
			return value
		}

		await this.set(key, fallbackValue)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Set (Forever) -> ${keyWithNamespace}: ${value}`)
		}
		return fallbackValue
	}

	public async has(key: string): Promise<boolean> {
		const keyWithNamespace = this.concatenateKey(key)
		const isExists = (await this._redisConnection.exists(keyWithNamespace)) === 1

		if (this._enableDebug) {
			console.debug(`CacheXS -> Has -> ${keyWithNamespace}? ${isExists}`)
		}

		return isExists
	}

	public async missing(key: string): Promise<boolean> {
		const keyWithNamespace = this.concatenateKey(key)
		const isExists = (await this._redisConnection.exists(keyWithNamespace)) === 0

		if (this._enableDebug) {
			console.debug(`CacheXS -> Missing -> ${keyWithNamespace}? ${isExists}`)
		}

		return isExists
	}

	public async delete(key: string): Promise<void> {
		const keyWithNamespace = this.concatenateKey(key)

		await this._redisConnection.del(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Delete -> ${key}`)
		}
	}

	public async deleteMany(keys: string[]): Promise<void> {
		const keysWithNamespace = keys.map((key) => this.concatenateKey(key))

		await this._redisConnection.del(keysWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Delete Multiple -> ${keys.join(', ')}`)
		}
	}

	public async clear(): Promise<void> {
		const keys = await this._redisConnection.keys(`${this._namespace}:*`)

		await this._redisConnection.del(keys)

		if (this._enableDebug) {
			console.debug('CacheXS -> Clear All Cache')
		}
	}

	public get redisUrl(): string | undefined {
		return this._redisUrl
	}

	public get redisConfig(): RedisOptions | undefined {
		return this._redisConfig
	}

	public get expiresIn(): number {
		return this._expiresIn
	}

	public get namespace(): string {
		return this._namespace
	}

	public get isDebugEnabled(): boolean {
		return this._enableDebug
	}
}
