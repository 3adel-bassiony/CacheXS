import { RedisClient, type RedisOptions } from 'bun'

import type { CacheXSConfig } from './types/CacheXSConfig'

export type { CacheXSConfig } from './types/CacheXSConfig'

export default class CacheXS {
	/**
	 * The maximum number of Redis keys processed in a single batch.
	 */
	private static readonly batchSize = 500

	/**
	 * The maximum number of batch operations allowed to run concurrently.
	 */
	private static readonly maxPendingBatches = 32

	/**
	 * Atomically retrieves a value or stores a serialized fallback when the key is missing.
	 * KEYS[1] is the full Redis key and ARGV[1] is the serialized fallback.
	 * ARGV[2] is the expiration in seconds, or an empty string for an entry without expiration.
	 * Returns the existing value, or a Redis null reply after storing the fallback.
	 */
	private static readonly getOrSetScript = `
local value = redis.call('GET', KEYS[1])
if value then return value end
if ARGV[2] == '' then
	redis.call('SET', KEYS[1], ARGV[1])
else
	redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
end
return false
`

	/**
	 * Atomically increments KEYS[1] and sets its expiration from ARGV[1] when the result is 1.
	 * Returns the counter value after incrementing.
	 */
	private static readonly incrementWithExpiryScript = `
local value = redis.call('INCR', KEYS[1])
if value == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return value
`

	/**
	 * The Redis connection used by the CacheXS package.
	 */
	protected _redisClient: RedisClient

	/**
	 * Indicates whether CacheXS created the Redis client and is responsible for closing it.
	 */
	private _ownsRedisClient = false

	/**
	 * Whether to replace an owned client after disconnection for the next operation.
	 */
	private _recoverOnDisconnect = false

	/**
	 * Whether this cache instance has been explicitly closed.
	 */
	private _closed = false

	/**
	 * The URL of the Redis server.
	 */
	protected _redisUrl: string | undefined

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
		recoverOnDisconnect = false,
		namespace = '',
		expiresIn = 300,
		enableDebug = false,
	}: CacheXSConfig = {}) {
		this.configureCacheXS({
			redisClient,
			redisUrl,
			redisOptions,
			recoverOnDisconnect,
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
	 * // Configure CacheXS with native Bun Redis options
	 * const cache = new CacheXS();
	 * cache.configureCacheXS({
	 *   redisUrl: 'redis://localhost:6379',
	 *   redisOptions: {
	 *     connectionTimeout: 5000,
	 *   },
	 *   namespace: 'cacheXS',
	 *   expiresIn: 60,
	 *   enableDebug: true,
	 * });
	 */
	protected configureCacheXS(options: CacheXSConfig, replaceClient = false) {
		if (this._closed) throw new Error('CacheXS is closed')

		const {
			redisClient,
			redisOptions,
			redisUrl,
			recoverOnDisconnect = this._recoverOnDisconnect,
			namespace = this._namespace ?? '',
			expiresIn = this._expiresIn ?? 300,
			enableDebug = this._enableDebug ?? false,
		} = options
		this.validateExpiry(expiresIn)

		if (replaceClient || redisClient || !this._redisClient || redisUrl !== undefined || redisOptions !== undefined) {
			const previousClient = this._redisClient
			const previousOwned = this._ownsRedisClient
			const replacingWithExternalClient = redisClient && redisClient !== previousClient
			const nextUrl = replacingWithExternalClient ? redisUrl : redisUrl ?? this._redisUrl
			const nextOptions = replacingWithExternalClient ? redisOptions : redisOptions ?? this._redisOptions
			const nextClient = redisClient ?? new RedisClient(nextUrl, nextOptions)

			this._redisClient = nextClient
			this._ownsRedisClient = nextClient === previousClient ? previousOwned : !redisClient
			this._redisUrl = nextUrl
			this._redisOptions = nextOptions

			if (previousOwned && previousClient !== nextClient) {
				// Intentional replacement must not trigger an old reconnect handler.
				previousClient.onclose = null
				previousClient.close()
			}
		}

		this._namespace = namespace
		this._expiresIn = expiresIn
		this._enableDebug = enableDebug
		const wasRecovering = this._recoverOnDisconnect
		this._recoverOnDisconnect = recoverOnDisconnect

		if (this._ownsRedisClient && (recoverOnDisconnect || wasRecovering)) {
			const client = this._redisClient
			client.onclose = recoverOnDisconnect
				? () => {
					if (this._closed || this._redisClient !== client) return

					this.configureCacheXS({}, true)
				}
				: null
		}
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
	 *   redisUrl: 'redis://localhost:6379',
	 *   redisOptions: {
	 *     connectionTimeout: 5000,
	 *   },
	 *   namespace: 'cacheXS',
	 *   expiresIn: 60,
	 *   enableDebug: true
	 * });
	 */
	public configure(options: CacheXSConfig): CacheXS {
		this.configureCacheXS(options)
		return this
	}

	/**
	 * Permanently closes this cache instance and disables client recovery.
	 * Only Redis clients created by CacheXS are closed; injected clients remain caller-owned.
	 * Repeated calls are safe. Create a new CacheXS instance to use the cache again.
	 *
	 * @example
	 * cache.close();
	 */
	public close(): void {
		if (this._closed) return

		this._closed = true
		if (!this._ownsRedisClient) return

		this._redisClient.onclose = null
		this._redisClient.close()
	}

	/**
	 * Validates the expiration time used when creating an expiring cache entry.
	 *
	 * @param {number} expiresIn - The expiration time in seconds.
	 * @returns {void} Returns normally when the expiration time is valid.
	 * @throws {RangeError} If expiresIn is not a positive safe integer.
	 *
	 * @example
	 * this.validateExpiry(60);
	 */
	private validateExpiry(expiresIn: number): void {
		if (!Number.isSafeInteger(expiresIn) || expiresIn <= 0) {
			throw new RangeError('expiresIn must be a positive safe integer in seconds')
		}
	}

	/**
	 * Serializes a cache value for storage in Redis.
	 * Objects and strings are JSON encoded, while null and undefined are stored as JSON null.
	 *
	 * @param {unknown} value - The value to serialize.
	 * @returns {string} The serialized value, with numeric values compatible with Redis counters.
	 * @throws {TypeError} If JSON serialization fails, such as for an object with circular references.
	 *
	 * @example
	 * const objectValue = this.serializeValue({ active: true }); // '{"active":true}'
	 * const stringValue = this.serializeValue('123'); // '"123"'
	 * const nullValue = this.serializeValue(undefined); // 'null'
	 */
	private serializeValue(value: unknown): string {
		if (typeof value === 'object' || typeof value === 'string') {
			return JSON.stringify(value) ?? 'null'
		}

		return value?.toString() ?? 'null'
	}

	/**
	 * Deserializes a Redis value, preserving raw strings that are not valid JSON.
	 *
	 * @template T - The expected type of the cached value.
	 * @param {string | null} value - The raw Redis value, or null when the key is missing.
	 * @returns {T | null} The parsed value, the original raw string, or null for a missing or JSON null value.
	 *
	 * @example
	 * const count = this.deserializeValue<number>('42'); // 42
	 * const message = this.deserializeValue<string>('hello'); // 'hello'
	 * const missing = this.deserializeValue<string>(null); // null
	 */
	private deserializeValue<T>(value: string | null): T | null {
		if (value === null) return null

		try {
			return JSON.parse(value) as T
		} catch {
			return value as T
		}
	}

	/**
	 * Prefixes a Redis glob pattern with the namespace, escaping pattern characters in the namespace.
	 * An already-prefixed pattern is accepted without duplicating the namespace.
	 *
	 * @param {string} pattern - The Redis glob pattern to match within the namespace.
	 * @returns {string} The pattern with a literal namespace prefix, or the original pattern for an empty namespace.
	 *
	 * @example
	 * // With namespace "myNamespace":
	 * const pattern = this.concatenatePattern('user:*');
	 * console.log(pattern); // Output: "myNamespace:user:*"
	 */
	private concatenatePattern(pattern: string): string {
		if (!this._namespace) return pattern

		const prefix = `${this._namespace}:`
		const localPattern = pattern.startsWith(prefix) ? pattern.slice(prefix.length) : pattern
		const escapedPrefix = prefix.replace(/[\\*?[\]]/g, '\\$&')

		return `${escapedPrefix}${localPattern}`
	}

	/**
	 * Processes non-empty pages of full Redis keys using SCAN.
	 * Continues until the cursor reaches zero, including when intermediate pages are empty.
	 * SCAN can return duplicate keys, and its count is a hint rather than a limit on page size.
	 * Awaits the operation for each page before requesting the next page.
	 *
	 * @param {string} pattern - The Redis glob pattern to match within the namespace.
	 * @param {number} count - The positive safe integer scan count hint.
	 * @param {(batch: string[]) => void | Promise<void>} operation - The operation to run on each page of full Redis keys.
	 * @returns {Promise<void>} A promise that resolves when all pages are processed, or rejects if scanning or processing fails.
	 * @throws {RangeError} If count is not a positive safe integer.
	 *
	 * @example
	 * await this.scanKeyBatches('user:*', 100, (keys) => {
	 *   console.debug(keys);
	 * });
	 */
	private async scanKeyBatches(
		pattern: string,
		count: number,
		operation: (batch: string[]) => void | Promise<void>
	): Promise<void> {
		if (!Number.isSafeInteger(count) || count <= 0) {
			throw new RangeError('count must be a positive safe integer')
		}

		const namespacedPattern = this.concatenatePattern(pattern)
		let cursor = '0'
		do {
			const [nextCursor, keys] = await this.redisClient.scan(cursor, 'MATCH', namespacedPattern, 'COUNT', count)
			cursor = nextCursor
			if (keys.length > 0) await operation(keys)
		} while (cursor !== '0')
	}

	/**
	 * Processes matching full Redis keys using SCAN pages or a single KEYS result.
	 * The KEYS option collects all matches with a blocking Redis command.
	 * Awaits each operation so SCAN pages are processed incrementally.
	 *
	 * @param {string} pattern - The Redis glob pattern to match within the namespace.
	 * @param {boolean} useScan - Whether to use SCAN (true) or KEYS (false).
	 * @param {(batch: string[]) => void | Promise<void>} operation - The operation to run on each batch of full Redis keys.
	 * @returns {Promise<void>} A promise that resolves when all matches are processed, or rejects if retrieval or processing fails.
	 *
	 * @example
	 * await this.matchingKeyBatches('session:*', true, async (keys) => {
	 *   await this.deleteKeys(keys);
	 * });
	 */
	private async matchingKeyBatches(
		pattern: string,
		useScan: boolean,
		operation: (batch: string[]) => void | Promise<void>
	): Promise<void> {
		if (useScan) {
			await this.scanKeyBatches(pattern, CacheXS.batchSize, operation)
		} else {
			const keys = await this.redisClient.keys(this.concatenatePattern(pattern))
			await operation(keys)
		}
	}

	/**
	 * Splits keys into batches and processes a bounded number of batches concurrently.
	 * Each batch contains at most batchSize keys, with at most maxPendingBatches operations pending.
	 * Keys are passed to the operation without modifying their namespace prefixes.
	 *
	 * @param {string[]} keys - The keys to process.
	 * @param {(batch: string[]) => Promise<void>} operation - The asynchronous operation to run for each batch.
	 * @returns {Promise<void>} A promise that resolves when all batches finish, or rejects if an operation fails.
	 *
	 * @example
	 * await this.forEachKeyBatch(['app:first', 'app:second'], async (batch) => {
	 *   await this.redisClient.del(...batch);
	 * });
	 */
	private async forEachKeyBatch(keys: string[], operation: (batch: string[]) => Promise<void>): Promise<void> {
		// Bound pending work while allowing Bun to pipeline independent batches.
		const windowSize = CacheXS.batchSize * CacheXS.maxPendingBatches
		for (let start = 0; start < keys.length; start += windowSize) {
			const pending: Promise<void>[] = []
			const end = Math.min(start + windowSize, keys.length)
			for (let index = start; index < end; index += CacheXS.batchSize) {
				pending.push(operation(keys.slice(index, index + CacheXS.batchSize)))
			}
			await Promise.all(pending)
		}
	}

	/**
	 * Deletes full Redis keys in bounded batches without adding namespace prefixes.
	 *
	 * @param {string[]} keys - The full Redis keys to delete.
	 * @returns {Promise<number>} A promise that resolves to the number of keys actually deleted, excluding missing keys.
	 *
	 * @example
	 * const deleted = await this.deleteKeys(['app:first', 'app:second']);
	 * console.log(deleted); // Output: 2 if both keys existed
	 */
	private async deleteKeys(keys: string[]): Promise<number> {
		let deleted = 0
		await this.forEachKeyBatch(keys, async (batch) => {
			const count = await this.redisClient.del(...batch)
			deleted += count
		})
		return deleted
	}

	/**
	 * Retrieves a cached value or atomically stores a fallback when the key is missing.
	 * Cached falsy values and existing expiration times are preserved.
	 * Cache hits use GET, while misses use a Lua script to check and create the entry atomically.
	 *
	 * @template T - The type of the cached value and fallback.
	 * @param {string} key - The key to retrieve or create in the cache.
	 * @param {T} value - The fallback value to store if the key is missing.
	 * @param {number} [expiresIn] - The expiration in seconds for new entries; omit to store without expiration.
	 * @returns {Promise<T>} A promise that resolves to the cached value or the fallback stored by the winning writer.
	 * @throws {RangeError} If the supplied expiration is not a positive safe integer.
	 *
	 * @example
	 * const temporary = await this.getOrSetValue('username', 'guest', 60);
	 * const permanent = await this.getOrSetValue('appName', 'My App');
	 */
	private async getOrSetValue<T>(key: string, value: T, expiresIn?: number): Promise<T> {
		if (expiresIn !== undefined) this.validateExpiry(expiresIn)
		const keyWithNamespace = this.concatenateKey(key)
		let existingValue = await this.redisClient.get(keyWithNamespace)

		// Keep cache hits to a GET and avoid serializing unused fallback values.
		if (existingValue === null) {
			existingValue = (await this.redisClient.send('EVAL', [
				CacheXS.getOrSetScript,
				'1',
				keyWithNamespace,
				this.serializeValue(value),
				expiresIn === undefined ? '' : String(expiresIn),
			])) as string | null
		}

		if (this._enableDebug) {
			console.debug(`CacheXS -> Get Or Set -> ${keyWithNamespace}`)
		}

		return existingValue === null ? value : (this.deserializeValue<T>(existingValue) as T)
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
	 * const cache = new CacheXS({ namespace: "myNamespace" });
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

		const value = await this.redisClient.get(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Get -> ${keyWithNamespace}: ${value}`)
		}

		return this.deserializeValue<T>(value)
	}

	/**
	 * Sets a value in the cache.
	 *
	 * @template T - The type of the value being set.
	 * @param {string} key - The key under which to store the value.
	 * @param {T} value - The value to be stored.
	 * @param {number} [expiresIn] - The expiration time in seconds.
	 * @returns {Promise<'OK' | null>} - The result of the Redis SET command.
	 *
	 * @example
	 * // Set a string value with default expiration time
	 * await cache.set('myKey', 'myValue');
	 *
	 * // Set an object value with custom expiration time
	 * await cache.set('myKey', { name: 'John', age: 30 }, 360);
	 */
	public async set<T>(key: string, value: T, expiresIn: number = this._expiresIn): Promise<'OK' | null> {
		this.validateExpiry(expiresIn)
		const keyWithNamespace = this.concatenateKey(key)
		const parsedValue = this.serializeValue(value)

		const result = await this.redisClient.set(keyWithNamespace, parsedValue, 'EX', expiresIn)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Set (For: ${expiresIn} Sec.) -> ${keyWithNamespace}: ${parsedValue}`)
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
		const parsedValue = this.serializeValue(value)

		await this.redisClient.set(keyWithNamespace, parsedValue)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Set (Forever) -> ${keyWithNamespace}: ${parsedValue}`)
		}
	}

	/**
	 * Atomically stores a value with expiration only when the key is missing.
	 * Existing values and their expiration times are preserved.
	 *
	 * @template T - The type of the value being stored.
	 * @param {string} key - The key under which to store the value.
	 * @param {T} value - The value to store if the key is missing.
	 * @param {number} [expiresIn] - The expiration in seconds, defaulting to the instance's configured expiration.
	 * @returns {Promise<'OK' | 'EXIST'>} A promise resolving to 'OK' when created or 'EXIST' when already present.
	 * @throws {RangeError} If expiresIn is not a positive safe integer.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * const result = await cache.setIfNotExists('username', 'guest', 60);
	 * console.log(result); // Output: 'OK' if created, or 'EXIST' if already cached
	 */
	public async setIfNotExists<T>(
		key: string,
		value: T,
		expiresIn: number = this._expiresIn
	): Promise<'OK' | 'EXIST'> {
		this.validateExpiry(expiresIn)
		const keyWithNamespace = this.concatenateKey(key)
		const result = await this.redisClient.set(
			keyWithNamespace,
			this.serializeValue(value),
			'EX',
			String(expiresIn),
			'NX'
		)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Set If Not Exists -> ${keyWithNamespace}: ${result ?? 'EXIST'}`)
		}

		return result === null ? 'EXIST' : 'OK'
	}

	/**
	 * Retrieves the value associated with the specified key from the cache. If the value does not exist, it sets the value to the provided fallback value and returns it.
	 * @param key - The key to retrieve or set the value for.
	 * @param value - The fallback value to set if the key does not exist in the cache.
	 * @param expiresIn - The expiration time in seconds for new entries.
	 * @returns A Promise that resolves to the retrieved value or the fallback value if the key does not exist.
	 *
	 * @example
	 * // Get the value associated with the key "username" from the cache. If it does not exist, set it to "guest" and return "guest".
	 * const username = await cache.getOrSet("username", "guest");
	 */
	public async getOrSet<T>(key: string, value: T, expiresIn: number = this._expiresIn): Promise<T> {
		return this.getOrSetValue(key, value, expiresIn)
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
		return this.getOrSetValue(key, fallbackValue)
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
		const value = await this.redisClient.incr(keyWithNamespace)

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
		const value = await this.redisClient.decr(keyWithNamespace)

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
		await this.redisClient.expire(keyWithNamespace, expiresIn)

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
		await this.redisClient.expire(keyWithNamespace, 0)

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
		const ttl = await this.redisClient.ttl(keyWithNamespace)

		if (this._enableDebug) {
			console.debug(`CacheXS -> TTL -> ${keyWithNamespace}: ${ttl}`)
		}
		return ttl
	}

	/**
	 * Increments the value of a key by one and sets the expiration time for the key.
	 * @param key - The key to increment.
	 * @param expiresIn - The expiration time in seconds.
	 * @returns A Promise that resolves to the new value after incrementing.
	 * @example
	 * const cache = new CacheXS();
	 * const value = await cache.incrementWithExpiry("myKey", 60);
	 */
	public async incrementWithExpiry(key: string, expiresIn: number): Promise<number> {
		this.validateExpiry(expiresIn)
		const keyWithNamespace = this.concatenateKey(key)
		const value = (await this.redisClient.send('EVAL', [
			CacheXS.incrementWithExpiryScript,
			'1',
			keyWithNamespace,
			String(expiresIn),
		])) as number

		if (this._enableDebug) {
			console.debug(`CacheXS -> Increment With Expiry -> ${keyWithNamespace}: ${value}`)
		}

		return value
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

		await this.redisClient.del(keyWithNamespace)

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

		await this.forEachKeyBatch(keys, async (batch) => {
			await this.redisClient.del(...batch.map((key) => this.concatenateKey(key)))
		})

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
		await this.deleteByPattern('*')

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
		const isExists = await this.redisClient.exists(keyWithNamespace)

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
		const isExists = await this.redisClient.exists(keyWithNamespace)

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
		const prefixLength = this._namespace ? this._namespace.length + 1 : 0
		const keys = new Set<string>()
		await this.scanKeyBatches(pattern, count, (batch) => {
			for (const key of batch) keys.add(key.slice(prefixLength))
		})

		if (this._enableDebug) {
			console.debug(`CacheXS -> Scan -> Pattern: ${pattern}, Found: ${keys.size} keys`)
		}

		return [...keys]
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
		const patternWithNamespace = this.concatenatePattern(pattern)
		const keys = await this.redisClient.keys(patternWithNamespace)

		const prefixLength = this._namespace ? this._namespace.length + 1 : 0
		const keysWithoutNamespace = keys.map((key) => key.slice(prefixLength))

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
		const result: { [key: string]: T | null } = {}
		const prefixLength = this._namespace ? this._namespace.length + 1 : 0

		await this.matchingKeyBatches(pattern, useScan, async (keys) => {
			await this.forEachKeyBatch(keys, async (batch) => {
				const values = await this.redisClient.mget(...batch)
				for (let offset = 0; offset < batch.length; offset++) {
					// Defining an own property also handles Redis keys named __proto__.
					Object.defineProperty(result, batch[offset].slice(prefixLength), {
						value: this.deserializeValue<T>(values[offset]),
						enumerable: true,
						configurable: true,
						writable: true,
					})
				}
			})
		})

		if (this._enableDebug) {
			console.debug(
				`CacheXS -> Get By Pattern -> Pattern: ${pattern}, Retrieved: ${Object.keys(result).length} items`
			)
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
		let deleted = 0
		await this.matchingKeyBatches(pattern, useScan, async (keys) => {
			deleted += await this.deleteKeys(keys)
		})

		if (this._enableDebug) {
			console.debug(`CacheXS -> Delete By Pattern -> Pattern: ${pattern}, Deleted: ${deleted} keys`)
		}

		return deleted
	}

	/**
	 * Pings the Redis server.
	 *
	 * @returns A promise that resolves to the result of the ping command.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * const result = await cache.ping();
	 * console.log(result); // "PONG"
	 */
	public async ping(message?: string): Promise<string> {
		const result = await this.redisClient.ping(message)

		if (this._enableDebug) {
			console.debug(`CacheXS -> Ping -> Message: ${message}, Result: ${result}`)
		}

		return result
	}

	/**
	 * Checks if the Redis connection is established.
	 *
	 * @returns A promise that resolves to a boolean indicating whether the Redis connection is established or not.
	 *
	 * @example
	 * const cache = new CacheXS();
	 * const isConnected = await cache.isConnected();
	 * console.log(isConnected); // true or false
	 */
	public async isConnected(): Promise<boolean> {
		try {
			const result = await this.redisClient.ping()
			if (this._enableDebug) {
				console.debug(`CacheXS -> Is Connected -> Result: ${result}`)
			}
			return result === 'PONG'
		} catch (error) {
			if (this._enableDebug) {
				console.debug('CacheXS -> Is Connected -> Connection failed', error)
			}
			return false
		}
	}

	/**
	 * Gets the Redis connection.
	 * Retrieve it for each operation because recovery can replace it.
	 *
	 * @returns {Redis} The Redis connection.
	 * @throws {Error} If the cache has been closed.
	 * @example
	 * const cache = new CacheXS();
	 * const redis = cache.redisClient;
	 * redis.set('key', 'value');
	 */
	public get redisClient(): RedisClient {
		if (this._closed) throw new Error('CacheXS is closed')

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
	 * console.log(config); // { connectionTimeout: 5000 }
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
