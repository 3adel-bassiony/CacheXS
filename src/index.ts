import Redis, { RedisOptions } from 'ioredis'

import { CacheXSConfig } from './types/CacheXSConfig'
import { SetOptions } from './types/SetOptions'

export default class CacheXS {
	/**
	 * The Redis connection used by the CacheXS package.
	 */
	protected _redisConnection: Redis

	/**
	 * The URL of the Redis server.
	 */
	protected _redisUrl: string | undefined

	/**
	 * Redis configuration options.
	 */
	protected _redisConfig: RedisOptions | undefined

	/**
	 * The namespace for the cache.
	 */
	protected _namespace: string

	/**
	 * The default expiration time in seconds for the cache item.
	 */
	protected _expiresIn: number

	/**
	 * Indicates whether debug mode is enabled or not.
	 */
	protected _enableDebug: boolean

	/**
	 * Constructs a new instance of the CacheXS class.
	 * @param {CacheXSConfig} [config] - The configuration options for CacheXS.
	 * @example
	 * // Create a new instance of CacheXS with default configuration
	 * const cache = new CacheXS();
	 *
	 * // Create a new instance of CacheXS with custom configuration
	 * const cache = new CacheXS({
	 *   redisUrl: 'redis://localhost:6379',
	 *   namespace: 'cacheXS',
	 *   expiresIn: 60,
	 *   enableDebug: true,
	 * });
	 */
	constructor({
		redisConnection,
		redisUrl,
		redisConfig,
		namespace = 'cacheXS',
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

	/**
	 * Configures the CacheXS instance with the provided options.
	 *
	 * @param {CacheXSConfig} options - The configuration options for CacheXS.
	 * @example
	 * // Configure CacheXS with Redis connection options
	 * const cache = new CacheXS();
	 * cache.configureCacheXS({
	 *   redisConnection: redisClient,
	 *   namespace: 'cacheXS',
	 *   expiresIn: 60,
	 *   enableDebug: true,
	 * });
	 *
	 * // Configure CacheXS with Redis URL
	 * const cache = new CacheXS();
	 * cache.configureCacheXS({
	 *   redisUrl: 'redis://localhost:6379',
	 *   namespace: 'cacheXS',
	 *   expiresIn: 60,
	 *   enableDebug: true,
	 * });
	 *
	 * // Configure CacheXS with Redis configuration object
	 * const cache = new CacheXS();
	 * cache.configureCacheXS({
	 *   redisConfig: {
	 *     host: 'localhost',
	 *     port: 6379,
	 *     password: '',
	 *   },
	 *   namespace: 'cacheXS',
	 *   expiresIn: 60,
	 *   enableDebug: true,
	 * });
	 */
	protected configureCacheXS({
		redisConnection,
		redisConfig,
		redisUrl,
		namespace = 'cacheXS',
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

	/**
	 * Configures the CacheXS instance with the provided options.
	 *
	 * @param {CacheXSConfig} options - The configuration options for CacheXS.
	 * @returns {CacheXS} The configured CacheXS instance.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * cache.configure({
	 *   redisConfig: {
	 * 		host: 'localhost',
	 *    	port: 6379,
	 *     	password: ''
	 * 	 },
	 *   namespace: 'cacheXS',
	 *   expiresIn: 60,
	 *   enableDebug: true
	 * });
	 */
	public configure({
		redisConnection,
		redisConfig,
		redisUrl,
		namespace = 'cacheXS',
		expiresIn = 300,
		enableDebug = false,
	}: CacheXSConfig): CacheXS {
		this.configureCacheXS({ redisConnection, redisConfig, redisUrl, namespace, expiresIn, enableDebug })
		return this
	}

	/**
	 * Concatenates the given key with the namespace and returns the resulting string.
	 * If a namespace is set, the key will be prefixed with the namespace followed by a colon.
	 * If no namespace is set, the key will be returned as is.
	 *
	 * @param key The key to concatenate with the namespace.
	 * @returns The concatenated key.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * cache.setNamespace("myNamespace");
	 * const concatenatedKey = cache.concatenateKey("myKey");
	 * console.log(concatenatedKey); // Output: "myNamespace:myKey"
	 */
	public concatenateKey(key: string): string {
		const namespace = this._namespace
		return namespace.length > 0 ? `${namespace}:${key}` : key
	}

	/**
	 * Retrieves the value associated with the specified key from the cache.
	 *
	 * @param key - The key of the value to retrieve.
	 * @returns A Promise that resolves to the retrieved value, or null if the key is not found.
	 *
	 * @example
	 * // Retrieve a string value from the cache
	 * const stringValue = await cache.get<string>('myKey');
	 *
	 * // Retrieve an object value from the cache
	 * const objectValue = await cache.get<MyObject>('myKey');
	 */
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

	/**
	 * Sets a value in the cache.
	 *
	 * @template T - The type of the value being set.
	 * @param {string} key - The key under which to store the value.
	 * @param {T} value - The value to be stored.
	 * @param {SetOptions} [options] - Optional settings for the cache entry.
	 * @returns {Promise<void>} - A Promise that resolves when the value is successfully set in the cache.
	 *
	 * @example
	 * // Set a string value with default expiration time
	 * await cache.set('myKey', 'myValue');
	 *
	 * // Set an object value with custom expiration time
	 * await cache.set('myKey', { name: 'John', age: 30 }, { expiresIn: 360 });
	 */
	public async set<T>(key: string, value: T, options?: SetOptions): Promise<void> {
		const expiresIn = options?.expiresIn ?? this._expiresIn
		const keyWithNamespace = this.concatenateKey(key)
		const parsedValue = typeof value === 'object' ? JSON.stringify(value) : (value as string | number | Buffer)

		await this._redisConnection.set(keyWithNamespace, parsedValue, 'EX', expiresIn)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Set (For: ${expiresIn} Sec.) -> ${keyWithNamespace}: ${value}`)
		}
	}

	/**
	 * Sets a value in the cache indefinitely.
	 *
	 * @param key - The key to associate with the value.
	 * @param value - The value to be stored in the cache.
	 * @returns A promise that resolves when the value is successfully set in the cache.
	 *
	 * @example
	 * // Set a string value in the cache
	 * await setForever("username", "JohnDoe");
	 *
	 * // Set an object value in the cache
	 * await cache.setForever("user", { name: "John Doe", age: 30 });
	 */
	public async setForever<T>(key: string, value: T): Promise<void> {
		const keyWithNamespace = this.concatenateKey(key)

		await this._redisConnection.set(keyWithNamespace, JSON.stringify(value))

		if (this._enableDebug) {
			console.debug(`CacheXS -> Set (Forever) -> ${keyWithNamespace}: ${value}`)
		}
	}

	/**
	 * Retrieves the value associated with the specified key from the cache. If the value does not exist, it sets the value to the provided fallback value and returns it.
	 * @param key - The key to retrieve or set the value for.
	 * @param fallbackValue - The value to set if the key does not exist in the cache.
	 * @param options - Optional settings for setting the value in the cache.
	 * @returns A Promise that resolves to the retrieved value or the fallback value if the key does not exist.
	 *
	 * @example
	 * // Get the value associated with the key "username" from the cache. If it does not exist, set it to "guest" and return "guest".
	 * const username = await cache.getOrSet("username", "guest");
	 */
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

	/**
	 * Retrieves the value associated with the specified key from the cache.
	 * If the value does not exist, sets the specified fallback value in the cache and returns it.
	 *
	 * @param key - The key to retrieve or set in the cache.
	 * @param fallbackValue - The value to set in the cache if the key does not exist.
	 * @returns A Promise that resolves to the retrieved value or the fallback value.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * const value = await cache.getOrSetForever("myKey", "defaultValue");
	 * console.log(value); // Output: "defaultValue" (if the key does not exist in the cache)
	 */
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

	/**
	 * Deletes a cache entry by its key.
	 *
	 * @param key The key of the cache entry to delete.
	 * @returns A Promise that resolves when the cache entry is deleted.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * await cache.delete("myKey");
	 */
	public async delete(key: string): Promise<void> {
		const keyWithNamespace = this.concatenateKey(key)

		await this._redisConnection.del(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Delete -> ${key}`)
		}
	}

	/**
	 * Deletes multiple cache entries specified by the given keys.
	 *
	 * @param keys - An array of keys representing the cache entries to be deleted.
	 * @returns A Promise that resolves when the cache entries are successfully deleted.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * const keys = ['key1', 'key2', 'key3'];
	 *
	 * await cache.deleteMany(keys);
	 */
	public async deleteMany(keys: string[]): Promise<void> {
		const keysWithNamespace = keys.map((key) => this.concatenateKey(key))

		await this._redisConnection.del(keysWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Delete Multiple -> ${keys.join(', ')}`)
		}
	}

	/**
	 * Clears all cache entries in the CacheXS instance.
	 * @returns A Promise that resolves when the cache is cleared.
	 * @example
	 * const cache = new CacheXS();
	 * await cache.clear();
	 */
	public async clear(): Promise<void> {
		const keys = await this._redisConnection.keys(`${this._namespace}:*`)

		await this._redisConnection.del(keys)

		if (this._enableDebug) {
			console.debug('CacheXS -> Clear All Cache')
		}
	}

	/**
	 * Checks if a key exists in the cache.
	 * @param key - The key to check.
	 * @returns A promise that resolves to a boolean indicating whether the key exists in the cache.
	 * @example
	 * const cache = new CacheXS();
	 * const exists = await cache.has("myKey");
	 * console.log(exists); // true or false
	 */
	public async has(key: string): Promise<boolean> {
		const keyWithNamespace = this.concatenateKey(key)
		const isExists = (await this._redisConnection.exists(keyWithNamespace)) === 1

		if (this._enableDebug) {
			console.debug(`CacheXS -> Has -> ${keyWithNamespace}? ${isExists}`)
		}

		return isExists
	}

	/**
	 * Checks if a key is missing in the cache.
	 *
	 * @param key - The key to check.
	 * @returns A promise that resolves to a boolean indicating whether the key is missing or not.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * const isMissing = await cache.missing("myKey");
	 * console.log(isMissing); // true or false
	 */
	public async missing(key: string): Promise<boolean> {
		const keyWithNamespace = this.concatenateKey(key)
		const isExists = (await this._redisConnection.exists(keyWithNamespace)) === 0

		if (this._enableDebug) {
			console.debug(`CacheXS -> Missing -> ${keyWithNamespace}? ${isExists}`)
		}

		return isExists
	}

	/**
	 * Gets the Redis connection.
	 *
	 * @returns {Redis} The Redis connection.
	 * @example
	 * const cache = new CacheXS();
	 * const redis = cache.redisConnection;
	 * redis.set('key', 'value');
	 */
	public get redisConnection(): Redis {
		return this._redisConnection
	}

	/**
	 * Gets the Redis URL.
	 *
	 * @returns The Redis URL as a string, or undefined if not set.
	 *
	 * @example
	 * ```typescript
	 * const cache = new CacheXS();
	 * const redisUrl = cache.redisUrl;
	 * console.log(redisUrl); // Output: "redis://localhost:6379"
	 * ```
	 */
	public get redisUrl(): string | undefined {
		return this._redisUrl
	}

	/**
	 * Gets the Redis configuration.
	 * @returns The RedisOptions object representing the Redis configuration.
	 * @example
	 * // Usage
	 * const cache = new CacheXS();
	 * const config = cache.redisConfig;
	 * console.log(config); // { host: 'localhost', port: 6379 }
	 */
	public get redisConfig(): RedisOptions | undefined {
		return this._redisConfig
	}

	/**
	 * Gets the expiration time in seconds.
	 *
	 * @returns {number} The expiration time in seconds.
	 * @example
	 * const cache = new CacheXS();
	 * const expiresIn = cache.expiresIn;
	 * console.log(expiresIn); // Output: 360
	 */
	public get expiresIn(): number {
		return this._expiresIn
	}

	/**
	 * Gets the namespace of the cache.
	 *
	 * @returns The namespace as a string.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * const namespace = cache.namespace;
	 * console.log(namespace); // Output: "default"
	 */
	public get namespace(): string {
		return this._namespace
	}

	/**
	 * Gets a value indicating whether debug mode is enabled.
	 *
	 * @returns {boolean} True if debug mode is enabled, false otherwise.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * console.log(cache.isDebugEnabled); // Output: false
	 */
	public get isDebugEnabled(): boolean {
		return this._enableDebug
	}
}
