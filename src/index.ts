import { redis, RedisClient, RedisOptions } from 'bun'

import { CacheXSConfig } from './types/CacheXSConfig'

export default class CacheXS {
	/**
	 * The Redis connection used by the CacheXS package.
	 */
	protected _redisClient = redis

	/**
	 * The URL of the Redis server.
	 */
	protected _redisUrl: string | undefined = process.env.REDIS_URL

	/**
	 * Redis configuration options.
	 */
	protected _redisOptions: RedisOptions | undefined

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
		redisClient,
		redisUrl,
		redisOptions,
		namespace = 'cacheXS',
		expiresIn = 300,
		enableDebug = false,
	}: CacheXSConfig = {}) {
		this.configureCacheXS({
			redisClient,
			redisUrl,
			redisOptions,
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
	 *   redisClient: redisClient,
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
	 *   redisOptions: {
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
		redisClient,
		redisOptions,
		redisUrl,
		namespace = 'cacheXS',
		expiresIn = 300,
		enableDebug = false,
	}: CacheXSConfig) {
		if (redisClient) {
			this._redisClient = redisClient
			this._redisOptions = redisOptions
		} else {
			this._redisClient = new RedisClient(redisUrl, redisOptions)
			this._redisUrl = redisUrl
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
	 *   redisOptions: {
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
		redisClient,
		redisOptions,
		redisUrl,
		namespace = 'cacheXS',
		expiresIn = 300,
		enableDebug = false,
	}: CacheXSConfig): CacheXS {
		this.configureCacheXS({ redisClient, redisOptions, redisUrl, namespace, expiresIn, enableDebug })
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
		if (namespace.length === 0) {
			return key
		}
		// Check if the key already starts with the namespace
		const namespacePrefix = `${namespace}:`
		if (key.startsWith(namespacePrefix)) {
			return key
		}
		return `${namespacePrefix}${key}`
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

		const value = await this._redisClient.get(keyWithNamespace)

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
	public async set<T>(key: string, value: T, expiresIn: number = this._expiresIn): Promise<'OK' | null> {
		const keyWithNamespace = this.concatenateKey(key)
		let parsedValue: unknown

		if (typeof value === 'object') {
			parsedValue = JSON.stringify(value)
		} else {
			parsedValue = value?.toString() ?? ''
		}

		const result = await this._redisClient.set(keyWithNamespace, parsedValue, 'EX', expiresIn)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Set (For: ${expiresIn} Sec.) -> ${keyWithNamespace}: ${value}`)
		}

		return result
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
		let parsedValue: unknown

		if (typeof value === 'object' && value !== null) {
			parsedValue = JSON.stringify(value)
		} else {
			parsedValue = value?.toString() ?? ''
		}

		await this._redisClient.set(keyWithNamespace, parsedValue)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Set (Forever) -> ${keyWithNamespace}: ${value}`)
		}
	}

	public async setIfNotExists<T>(key: string, value: T, expiresIn: number = this._expiresIn) {
		const keyWithNamespace = this.concatenateKey(key)
		const exists = await this.exists(keyWithNamespace)

		if (exists) {
			return 'EXIST'
		}

		const result = await this.set(key, value, expiresIn)
		return result
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
	public async getOrSet<T>(key: string, value: T, expiresIn: number = this._expiresIn): Promise<T> {
		const keyWithNamespace = this.concatenateKey(key)

		const existingValue = await this.get<T>(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Get -> ${keyWithNamespace}: ${existingValue}`)
		}

		if (existingValue) {
			return existingValue
		}

		await this.set(key, value, expiresIn)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Set (For: ${expiresIn} Sec.) -> ${keyWithNamespace}: ${existingValue}`)
		}

		return value
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
	 * Increments the value of a key by one.
	 *
	 * @param {string} key - The key to increment.
	 * @returns {Promise<number>} - A Promise that resolves to the new value after incrementing.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * const value = await cache.increment("myKey");
	 * console.log(value); // Output: 1 (if the key does not exist in the cache)
	 */
	public async increment(key: string): Promise<number> {
		const keyWithNamespace = this.concatenateKey(key)
		const value = await this._redisClient.incr(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Increment -> ${keyWithNamespace}: ${value}`)
		}

		return value
	}

	/**
	 * Decrements the value of a key by one.
	 *
	 * @param {string} key - The key to decrement.
	 * @returns {Promise<number>} - A Promise that resolves to the new value after decrementing.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * const value = await cache.decrement("myKey");
	 * console.log(value); // Output: -1 (if the key does not exist in the cache)
	 */
	public async decrement(key: string): Promise<number> {
		const keyWithNamespace = this.concatenateKey(key)
		const value = await this._redisClient.decr(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Decrement -> ${keyWithNamespace}: ${value}`)
		}

		return value
	}

	/**
	 * Sets the expiration time for a key.
	 * @param key - The key to set the expiration time for.
	 * @param expiresIn - The expiration time in seconds.
	 * @returns A Promise that resolves when the expiration time is set.
	 * @example
	 * const cache = new CacheXS();
	 * await cache.expire("myKey", 60);
	 */

	public async expire(key: string, expiresIn: number): Promise<void> {
		const keyWithNamespace = this.concatenateKey(key)
		await this._redisClient.expire(keyWithNamespace, expiresIn)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Expire -> ${keyWithNamespace}: ${expiresIn}`)
		}
	}

	/**
	 * Expires a key immediately.
	 * @param key - The key to expire.
	 * @returns A Promise that resolves when the key is expired.
	 * @example
	 * const cache = new CacheXS();
	 * await cache.expireNow("myKey");
	 */
	public async expireNow(key: string): Promise<void> {
		const keyWithNamespace = this.concatenateKey(key)
		await this._redisClient.expire(keyWithNamespace, 0)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Expire Now -> ${keyWithNamespace}`)
		}
	}

	/**
	 * Gets the time to live for a key.
	 * @param key - The key to get the time to live for.
	 * @returns A Promise that resolves to the time to live in seconds.
	 * @example
	 * const cache = new CacheXS();
	 * const ttl = await cache.ttl("myKey");
	 * console.log(ttl); // Output: 60
	 */
	public async ttl(key: string): Promise<number> {
		const keyWithNamespace = this.concatenateKey(key)
		const ttl = await this._redisClient.ttl(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> TTL -> ${keyWithNamespace}: ${ttl}`)
		}
		return ttl
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

		await this._redisClient.del(keyWithNamespace)

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
		if (keys.length === 0) {
			return
		}

		const keysWithNamespace = keys.map((key) => this.concatenateKey(key))

		await Promise.all(keysWithNamespace.map((key) => this._redisClient.del(key)))

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
		const keys = await this._redisClient.keys(`${this._namespace}:*`)

		if (keys.length > 0) {
			await Promise.all(keys.map((key) => this._redisClient.del(key)))
		}

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
	 * const exists = await cache.exists("myKey");
	 * console.log(exists); // true or false
	 */
	public async exists(key: string): Promise<boolean> {
		const keyWithNamespace = this.concatenateKey(key)
		const isExists = await this._redisClient.exists(keyWithNamespace)

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
		const isExists = await this._redisClient.exists(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Missing -> ${keyWithNamespace}? ${isExists}`)
		}

		return !isExists
	}

	/**
	 * Finds Redis keys matching a pattern using SCAN instead of KEYS
	 *
	 * This function is a more efficient alternative to Redis.keys() for production environments.
	 * It uses the SCAN command which is non-blocking and designed for production use.
	 *
	 * @param {string} pattern - The pattern to match (e.g., "user:*", "session:*:active")
	 * @param {number} count - The number of keys to scan per iteration (default: 100)
	 * @returns {Promise<string[]>} Array of matching keys (without namespace prefix)
	 *
	 * @example
	 * const cache = new CacheXS();
	 * // Find all user keys
	 * const userKeys = await cache.scan("user:*");
	 * console.log(userKeys); // ["user:123", "user:456"]
	 *
	 * // Find keys with custom count
	 * const sessionKeys = await cache.scan("session:*", 50);
	 */
	public async scan(pattern: string, count: number = 100): Promise<string[]> {
		let cursor = '0'
		const keys: string[] = []
		const patternWithNamespace = this.concatenateKey(pattern)

		do {
			// SCAN returns an array where the first element is the new cursor
			// and the second element is an array of matched keys
			const [nextCursor, matchedKeys] = (await this._redisClient.scan(
				cursor,
				'MATCH',
				patternWithNamespace,
				'COUNT',
				count
			)) as [string, string[]]

			cursor = nextCursor

			// Remove namespace prefix from results
			const keysWithoutNamespace = matchedKeys.map((key) =>
				this._namespace.length > 0 ? key.replace(`${this._namespace}:`, '') : key
			)
			keys.push(...keysWithoutNamespace)
		} while (cursor !== '0')

		if (this._enableDebug) {
			console.debug(`CacheXS -> Scan -> Pattern: ${pattern}, Found: ${keys.length} keys`)
		}

		return keys
	}

	/**
	 * Finds Redis keys matching a pattern using the KEYS command
	 *
	 * Note: This method uses the KEYS command which blocks Redis while executing.
	 * For production environments with large datasets, consider using scan() instead.
	 *
	 * @param {string} pattern - The pattern to match (e.g., "user:*", "session:*:active")
	 * @returns {Promise<string[]>} Array of matching keys (without namespace prefix)
	 *
	 * @example
	 * const cache = new CacheXS();
	 * // Find all user keys
	 * const userKeys = await cache.keys("user:*");
	 * console.log(userKeys); // ["user:123", "user:456"]
	 */
	public async keys(pattern: string): Promise<string[]> {
		const patternWithNamespace = this.concatenateKey(pattern)
		const keys = await this._redisClient.keys(patternWithNamespace)

		// Remove namespace prefix from results
		const keysWithoutNamespace = keys.map((key) =>
			this._namespace.length > 0 ? key.replace(`${this._namespace}:`, '') : key
		)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Keys -> Pattern: ${pattern}, Found: ${keysWithoutNamespace.length} keys`)
		}

		return keysWithoutNamespace
	}

	/**
	 * Retrieves multiple values by pattern matching
	 *
	 * @param {string} pattern - The pattern to match (e.g., "user:*", "session:*:active")
	 * @param {boolean} useScan - Whether to use SCAN (true) or KEYS (false) command (default: true)
	 * @returns {Promise<{[key: string]: T | null}>} Object with keys and their values
	 *
	 * @example
	 * const cache = new CacheXS();
	 * // Get all user data
	 * const userData = await cache.getByPattern<User>("user:*");
	 * console.log(userData); // { "user:123": {...}, "user:456": {...} }
	 */
	public async getByPattern<T>(pattern: string, useScan: boolean = true): Promise<{ [key: string]: T | null }> {
		const matchingKeys = useScan ? await this.scan(pattern) : await this.keys(pattern)
		const result: { [key: string]: T | null } = {}

		// Use Promise.all for concurrent fetching
		const values = await Promise.all(matchingKeys.map((key) => this.get<T>(key)))

		matchingKeys.forEach((key, index) => {
			result[key] = values[index]
		})

		if (this._enableDebug) {
			console.debug(`CacheXS -> Get By Pattern -> Pattern: ${pattern}, Retrieved: ${matchingKeys.length} items`)
		}

		return result
	}

	/**
	 * Deletes keys matching a pattern
	 *
	 * @param {string} pattern - The pattern to match (e.g., "user:*", "session:*:active")
	 * @param {boolean} useScan - Whether to use SCAN (true) or KEYS (false) command (default: true)
	 * @returns {Promise<number>} Number of keys deleted
	 *
	 * @example
	 * const cache = new CacheXS();
	 * // Delete all expired sessions
	 * const deletedCount = await cache.deleteByPattern("session:*:expired");
	 * console.log(`Deleted ${deletedCount} expired sessions`);
	 */
	public async deleteByPattern(pattern: string, useScan: boolean = true): Promise<number> {
		const matchingKeys = useScan ? await this.scan(pattern) : await this.keys(pattern)

		if (matchingKeys.length > 0) {
			await this.deleteMany(matchingKeys)
		}

		if (this._enableDebug) {
			console.debug(`CacheXS -> Delete By Pattern -> Pattern: ${pattern}, Deleted: ${matchingKeys.length} keys`)
		}

		return matchingKeys.length
	}

	/**
	 * Gets the Redis connection.
	 *
	 * @returns {Redis} The Redis connection.
	 * @example
	 * const cache = new CacheXS();
	 * const redis = cache.redisClient;
	 * redis.set('key', 'value');
	 */
	public get redisClient(): RedisClient {
		return this._redisClient
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
	 * const config = cache.redisOptions;
	 * console.log(config); // { host: 'localhost', port: 6379 }
	 */
	public get redisOptions(): RedisOptions | undefined {
		return this._redisOptions
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
