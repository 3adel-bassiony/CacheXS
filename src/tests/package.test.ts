import { RedisClient } from 'bun'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'

import CacheXS, { type CacheXSConfig } from '../index'

import { startRedisServer } from './redisServer'

let redisUrl: string
let redisServer: Awaited<ReturnType<typeof startRedisServer>>
let testRedis: RedisClient
const caches = new Set<CacheXS>()

function createCache(config: CacheXSConfig = {}): CacheXS {
	const cache = new CacheXS({ redisUrl, ...config })
	caches.add(cache)
	return cache
}

beforeAll(async () => {
	redisServer = await startRedisServer()
	redisUrl = redisServer.url
	testRedis = redisServer.client
})

beforeEach(async () => {
	await testRedis.send('FLUSHDB', [])
})

afterEach(() => {
	mock.restore()
	for (const cache of caches) {
		cache.redisClient.onclose = null
		cache.redisClient.close()
	}
	caches.clear()
})

afterAll(async () => {
	await redisServer?.stop()
})

describe('Create Cache Instance', () => {
	it('Should create a new instance for Cache class with default configuration', async () => {
		const cache = createCache()

		expect(cache).toBeInstanceOf(CacheXS)
		expect(cache.namespace).toStrictEqual('')
		expect(cache.expiresIn).toStrictEqual(300)
		expect(cache.isDebugEnabled).toStrictEqual(false)
	})

	it('Should connect with default configuration using REDIS_URL', async () => {
		const moduleUrl = new URL('../index.ts', import.meta.url).href
		const child = Bun.spawn(
			[
				process.execPath,
				'--eval',
				`import CacheXS from ${JSON.stringify(moduleUrl)};
const cache = new CacheXS();
try { process.stdout.write(await cache.ping()) }
finally { cache.redisClient.close() }`,
			],
			{ env: { ...process.env, REDIS_URL: redisUrl, VALKEY_URL: redisUrl }, stdout: 'pipe', stderr: 'pipe' }
		)
		const [output, errors, exitCode] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		])

		expect(errors).toBe('')
		expect(exitCode).toBe(0)
		expect(output).toBe('PONG')
	})

	it('Should create a new instance for Cache class with redis connection', async () => {
		const bunRedis = new RedisClient(redisUrl)

		const cache = createCache({
			redisClient: bunRedis,
		})

		expect(cache).toBeInstanceOf(CacheXS)
		expect(cache.namespace).toStrictEqual('')
		expect(cache.expiresIn).toStrictEqual(300)
		expect(cache.isDebugEnabled).toStrictEqual(false)
	})

	it('Should create a new instance for Cache class with redis url', async () => {
		const cache = createCache({
			redisUrl,
		})

		expect(cache).toBeInstanceOf(CacheXS)
		expect(cache.redisUrl).toBe(redisUrl)
	})

	it('Should create a new instance for Cache class and configure it later', async () => {
		const cache = createCache()
		cache.configure({ redisUrl })
		expect(cache).toBeInstanceOf(CacheXS)
		expect(cache.redisUrl).toBe(redisUrl)
	})

	it('Should create a new instance for Cache class and change the default cache namespace', async () => {
		const cache = createCache({
			namespace: 'test',
		})
		await cache.set('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')
	})

	it('Should create a new instance for Cache class and change the default expires in seconds', async () => {
		const cache = createCache({
			expiresIn: 1,
		})
		await cache.set('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')
		await Bun.sleep(1100)
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should get the cache class instance details', async () => {
		const cache = createCache({ redisUrl: undefined })
		expect(cache).toBeInstanceOf(CacheXS)
		// expect(cache.redisConfig).toMatchObject(redisConfig)
		expect(cache.redisUrl).toBeUndefined()
		expect(cache.expiresIn).toBe(300)
		expect(cache.namespace).toBe('')
		expect(cache.isDebugEnabled).toBe(false)
	})

	it('Should test the concatenateKey method', async () => {
		const cache = createCache({ namespace: 'cacheXS' })
		expect(cache.concatenateKey('foo')).toBe('cacheXS:foo')
		expect(cache.concatenateKey('foo:bar')).toBe('cacheXS:foo:bar')
	})
})

describe('Set Cache', () => {
	it('Should set a value in cache', async () => {
		const cache = createCache()
		await cache.set('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')
	})

	it('Should set a value with object in cache', async () => {
		const cache = createCache()

		const object = { name: 'John', age: 30 }
		await cache.set('foo', object)
		const value = await cache.get<typeof object>('foo')
		expect(value).toStrictEqual(object)
	})

	it('Should set a value with number in cache', async () => {
		const cache = createCache()
		await cache.set('foo', 123)
		const value = await cache.get<number>('foo')
		expect(value).toBe(123)
	})

	it('Should set a value with string in cache', async () => {
		const cache = createCache()
		await cache.set('foo', 'bar')
		const value = await cache.get<string>('foo')
		expect(value).toBe('bar')
	})

	it('Should set a value with boolean in cache', async () => {
		const cache = createCache()
		await cache.set('foo', true)
		const value = await cache.get<boolean>('foo')

		expect(value).toBe(true)
	})

	it('Should set a value with null in cache', async () => {
		const cache = createCache()
		await cache.set('foo', null)
		const value = await cache.get<null>('foo')
		expect(value).toBeNull()
	})

	it('Should set a value with undefined in cache', async () => {
		const cache = createCache()
		await cache.set('foo', undefined)
		const value = await cache.get<undefined>('foo')
		expect(value).toBeNull()
	})

	it('Should set a value in cache with nested namespace', async () => {
		const cache = createCache()
		await cache.set('foo:bar', 'baz')
		const value = await cache.get('foo:bar')
		expect(value).toBe('baz')
	})

	it('Should set a value in cache with expiration', async () => {
		const cache = createCache()
		await cache.set('foo', 'bar', 1)
		const value = await cache.get('foo')
		expect(value).toBe('bar')
		await Bun.sleep(1100)
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should set a value in cache forever', async () => {
		const cache = createCache()
		await cache.setForever('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')
	})

	it('Should set a value in cache forever with nested namespace', async () => {
		const cache = createCache()
		await cache.setForever('foo:bar', 'baz')
		const value = await cache.get('foo:bar')
		expect(value).toBe('baz')
	})

	it('Should set a value in cache if it does not exist', async () => {
		const cache = createCache()
		await cache.setIfNotExists('foo', 'bar')
		const value = await cache.get<string>('foo')
		expect(value).toBe('bar')
	})

	it('Should set a value in cache if it does not exist with nested namespace', async () => {
		const cache = createCache({ namespace: 'test' })

		const result = await cache.setIfNotExists('foo:foo:bar', 'baz')
		expect(result).toBe('OK')
		const value = await cache.get<string>('foo:foo:bar')
		expect(value).toBe('baz')
	})

	it('Should not set a value in cache if already exists', async () => {
		const cache = createCache()
		await cache.set('foo', 'bar')
		const result = await cache.setIfNotExists('foo', 'zoo')
		expect(result).toBe('EXIST')
		const value = await cache.get<string>('foo')
		expect(value).toBe('bar')
	})
})

describe('Get Cache', () => {
	it('Should get a value from cache', async () => {
		const cache = createCache()
		await cache.set('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')
	})

	it('Should get a value from cache with nested namespace', async () => {
		const cache = createCache()
		await cache.set('foo:bar', 'baz')
		const value = await cache.get('foo:bar')
		expect(value).toBe('baz')
	})

	it('Should get a value from cache with expiration', async () => {
		const cache = createCache()
		await cache.set('foo', 'bar', 1)
		const value = await cache.get('foo')
		expect(value).toBe('bar')
		await Bun.sleep(1100)
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should get a value from cache forever', async () => {
		const cache = createCache()
		await cache.setForever('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')
	})

	it('Should get a value from cache forever with namespace', async () => {
		const cache = createCache()
		await cache.setForever('foo:bar', 'baz')
		const value = await cache.get('foo:bar')
		expect(value).toBe('baz')
	})

	it('Should check if the key is exists in cache', async () => {
		const cache = createCache()
		await cache.set('foo', 'bar')
		const isExists = await cache.exists('foo')
		expect(isExists).toBe(true)
	})

	it('Should check if the key is missing in cache', async () => {
		const cache = createCache()
		await cache.set('foo', 'bar')
		const isMissing = await cache.missing('foo')
		expect(isMissing).toBe(false)
	})
})

describe('Other Helpers', () => {
	it('Should expire a key after a certain time', async () => {
		const cache = createCache()

		await cache.set('foo', 'bar', 5)
		await cache.expire('foo', 1)
		const value = await cache.get('foo')
		expect(value).toBe('bar')
		await Bun.sleep(1100)
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should expire a key immediately', async () => {
		const cache = createCache()
		await cache.set('foo', 'bar', 5)
		await cache.expireNow('foo')
		const value = await cache.get('foo')
		expect(value).toBeNull()
	})

	it('Should get the time to live for a key', async () => {
		const cache = createCache()
		await cache.set('foo', 'bar', 1)
		const ttl = await cache.ttl('foo')
		expect(ttl).toBe(1)
	})

	it('Should increment the value of a key by one', async () => {
		const cache = createCache()
		await cache.set('foo', 0)
		const value = await cache.increment('foo')
		expect(value).toBe(1)
	})

	it('Should decrement the value of a key by one', async () => {
		const cache = createCache()
		await cache.set('foo', 1)
		const value = await cache.decrement('foo')
		expect(value).toBe(0)
	})

	it('Should increment a new key with expiry', async () => {
		const cache = createCache()
		const value = await cache.incrementWithExpiry('counter', 2)
		expect(value).toBe(1)

		// Verify the key exists
		const exists = await cache.exists('counter')
		expect(exists).toBe(true)

		// Verify it expires after 2 seconds
		await Bun.sleep(2100)
		const expiredValue = await cache.get('counter')
		expect(expiredValue).toBeNull()
	})

	it('Should increment existing key with expiry only on first increment', async () => {
		const cache = createCache()

		// First increment - should set expiry
		const firstValue = await cache.incrementWithExpiry('counter', 5)
		expect(firstValue).toBe(1)

		// Get initial TTL
		const initialTtl = await cache.ttl('counter')
		expect(initialTtl).toBeGreaterThan(0)
		expect(initialTtl).toBeLessThanOrEqual(5)

		// Second increment - should NOT reset expiry
		const secondValue = await cache.incrementWithExpiry('counter', 10)
		expect(secondValue).toBe(2)

		// TTL should still be from the first increment, not 10
		const newTtl = await cache.ttl('counter')
		expect(newTtl).toBeLessThanOrEqual(initialTtl)

		// Third increment
		const thirdValue = await cache.incrementWithExpiry('counter', 10)
		expect(thirdValue).toBe(3)
	})

	it('Should handle multiple increments with expiry correctly', async () => {
		const cache = createCache()

		const value1 = await cache.incrementWithExpiry('hits', 3)
		const value2 = await cache.incrementWithExpiry('hits', 3)
		const value3 = await cache.incrementWithExpiry('hits', 3)

		expect(value1).toBe(1)
		expect(value2).toBe(2)
		expect(value3).toBe(3)

		// Should expire after 3 seconds
		await Bun.sleep(3100)
		const expiredValue = await cache.get('hits')
		expect(expiredValue).toBeNull()
	})

	it('Should work with namespace in incrementWithExpiry', async () => {
		const cache = createCache({ namespace: 'test' })

		const value = await cache.incrementWithExpiry('views:page1', 2)
		expect(value).toBe(1)

		// Verify the key exists with namespace
		const exists = await cache.exists('views:page1')
		expect(exists).toBe(true)

		// Verify it has TTL set
		const ttl = await cache.ttl('views:page1')
		expect(ttl).toBeGreaterThan(0)
		expect(ttl).toBeLessThanOrEqual(2)
	})

	it('Should reset counter after expiry with incrementWithExpiry', async () => {
		const cache = createCache()

		// First increment
		const value1 = await cache.incrementWithExpiry('temp', 1)
		expect(value1).toBe(1)

		// Wait for expiry
		await Bun.sleep(1100)

		// Should start from 1 again after expiry
		const value2 = await cache.incrementWithExpiry('temp', 2)
		expect(value2).toBe(1)

		// Verify new TTL is set
		const ttl = await cache.ttl('temp')
		expect(ttl).toBeGreaterThan(0)
		expect(ttl).toBeLessThanOrEqual(2)
	})

	it('Should handle incrementWithExpiry with different keys', async () => {
		const cache = createCache()

		const counter1 = await cache.incrementWithExpiry('counter1', 5)
		const counter2 = await cache.incrementWithExpiry('counter2', 5)
		const counter1Again = await cache.incrementWithExpiry('counter1', 5)

		expect(counter1).toBe(1)
		expect(counter2).toBe(1)
		expect(counter1Again).toBe(2)

		// Both should exist
		expect(await cache.exists('counter1')).toBe(true)
		expect(await cache.exists('counter2')).toBe(true)
	})
})

describe('Delete & Clear Cache', () => {
	it('Should delete an item from cache', async () => {
		const cache = createCache()

		await cache.set('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')

		await cache.delete('foo')

		const valueAfterDelete = await cache.get('foo')
		expect(valueAfterDelete).toBeNull()
	})

	it('Should delete an item from cache with nested namespace', async () => {
		const cache = createCache({ namespace: 'test' })

		await cache.set('foo:bar', 'baz')
		const value = await cache.get('foo:bar')
		expect(value).toBe('baz')

		await cache.delete('foo:bar')
		const valueAfterDelete = await cache.get('foo:bar')
		expect(valueAfterDelete).toBeNull()
	})

	it('Should delete many items from cache', async () => {
		const cache = createCache()

		await cache.set('foo', 'bar')
		await cache.set('foo:bar', 'baz')

		const value = await cache.get('foo')
		const value2 = await cache.get('foo:bar')

		expect(value).toBe('bar')
		expect(value2).toBe('baz')

		await cache.deleteMany(['foo', 'foo:bar'])

		const valueAfterDelete = await cache.get('foo')
		const valueAfterDelete2 = await cache.get('foo:bar')
		expect(valueAfterDelete).toBeNull()
		expect(valueAfterDelete2).toBeNull()
	})

	it('Should clear all cache', async () => {
		const cache = createCache({ namespace: 'clear' })

		await cache.set('foo', 'bar')
		await cache.set('foo2', 'bar2')

		const value = await cache.get('foo')
		const value2 = await cache.get('foo2')
		expect(value).toBe('bar')
		expect(value2).toBe('bar2')

		await cache.clear()

		const valueAfterClear = await cache.get('foo')
		const valueAfterClear2 = await cache.get('foo2')

		expect(valueAfterClear).toBeNull()
		expect(valueAfterClear2).toBeNull()
	})
})

describe('Pattern-Based Key Operations', () => {
	// Setup test data before each test
	const setupTestData = async (cache: CacheXS) => {
		// Clear any existing data first
		await cache.clear()

		await cache.set('user:123', { name: 'John', age: 30 })
		await cache.set('user:456', { name: 'Jane', age: 25 })
		await cache.set('user:789', { name: 'Bob', age: 35 })
		await cache.set('session:abc123', { userId: 123, active: true })
		await cache.set('session:def456', { userId: 456, active: false })
		await cache.set('config:app', { theme: 'dark', lang: 'en' })
		await cache.set('config:db', { host: 'localhost', port: 5432 })
		await cache.set('temp:cache:1', 'temporary data 1')
		await cache.set('temp:cache:2', 'temporary data 2')
	}

	describe('scan method', () => {
		it('Should find keys matching pattern using scan', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const userKeys = await cache.scan('user:*')
			expect(userKeys).toHaveLength(3)
			expect(userKeys).toContain('user:123')
			expect(userKeys).toContain('user:456')
			expect(userKeys).toContain('user:789')
		})

		it('Should find keys with nested pattern using scan', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const tempKeys = await cache.scan('temp:cache:*')
			expect(tempKeys).toHaveLength(2)
			expect(tempKeys).toContain('temp:cache:1')
			expect(tempKeys).toContain('temp:cache:2')
		})

		it('Should handle custom count parameter in scan', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const userKeys = await cache.scan('user:*', 1)
			expect(userKeys).toHaveLength(3) // Should still find all keys despite small count
		})

		it('Should return empty array when no keys match pattern in scan', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const nonExistentKeys = await cache.scan('nonexistent:*')
			expect(nonExistentKeys).toHaveLength(0)
		})

		it('Should work with different namespaces in scan', async () => {
			const cache = createCache({ namespace: 'testapp' })
			await cache.set('user:123', 'data')
			await cache.set('user:456', 'data')

			const userKeys = await cache.scan('user:*')
			expect(userKeys).toHaveLength(2)
			expect(userKeys).toContain('user:123')
			expect(userKeys).toContain('user:456')
		})
	})

	describe('keys method', () => {
		it('Should find keys matching pattern using keys command', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const sessionKeys = await cache.keys('session:*')
			expect(sessionKeys).toHaveLength(2)
			expect(sessionKeys).toContain('session:abc123')
			expect(sessionKeys).toContain('session:def456')
		})

		it('Should find keys with wildcard patterns', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const configKeys = await cache.keys('config:*')
			expect(configKeys).toHaveLength(2)
			expect(configKeys).toContain('config:app')
			expect(configKeys).toContain('config:db')
		})

		it('Should return empty array when no keys match in keys method', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const emptyResult = await cache.keys('missing:*')
			expect(emptyResult).toHaveLength(0)
		})

		it('Should work with single character wildcards', async () => {
			const cache = createCache()
			await cache.clear()
			await cache.set('test:a', 'value1')
			await cache.set('test:b', 'value2')
			await cache.set('test:ab', 'value3')

			const singleCharKeys = await cache.keys('test:?')
			expect(singleCharKeys).toHaveLength(2)
			expect(singleCharKeys).toContain('test:a')
			expect(singleCharKeys).toContain('test:b')
		})
	})

	describe('getByPattern method', () => {
		it('Should retrieve multiple values by pattern using scan', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const userData = await cache.getByPattern<{ name: string; age: number }>('user:*')
			expect(Object.keys(userData)).toHaveLength(3)
			expect(userData['user:123']).toEqual({ name: 'John', age: 30 })
			expect(userData['user:456']).toEqual({ name: 'Jane', age: 25 })
			expect(userData['user:789']).toEqual({ name: 'Bob', age: 35 })
		})

		it('Should retrieve multiple values by pattern using keys command', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const configData = await cache.getByPattern('config:*', false) // Use keys instead of scan
			expect(Object.keys(configData)).toHaveLength(2)
			expect(configData['config:app']).toEqual({ theme: 'dark', lang: 'en' })
			expect(configData['config:db']).toEqual({ host: 'localhost', port: 5432 })
		})

		it('Should handle mixed data types in getByPattern', async () => {
			const cache = createCache()
			await cache.clear()
			await cache.set('mixed:string', 'hello')
			await cache.set('mixed:number', 42)
			await cache.set('mixed:object', { key: 'value' })

			const mixedData = await cache.getByPattern('mixed:*')
			expect(mixedData['mixed:string']).toBe('hello')
			expect(mixedData['mixed:number']).toBe(42)
			expect(mixedData['mixed:object']).toEqual({ key: 'value' })
		})

		it('Should return empty object when no keys match pattern in getByPattern', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const emptyResult = await cache.getByPattern('nonexistent:*')
			expect(Object.keys(emptyResult)).toHaveLength(0)
		})

		it('Should handle null values in getByPattern', async () => {
			const cache = createCache()
			await cache.clear()
			await cache.set('test:exists', 'value')
			// Simulate a key that might have expired or been deleted
			await cache.delete('test:exists')
			await cache.set('test:other', 'other value')

			const result = await cache.getByPattern('test:*')
			expect(result['test:other']).toBe('other value')
			expect(result['test:exists']).toBeUndefined() // Non-existent keys shouldn't appear in result
		})
	})

	describe('deleteByPattern method', () => {
		it('Should delete keys matching pattern using scan', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const deletedCount = await cache.deleteByPattern('session:*')
			expect(deletedCount).toBe(2)

			// Verify deletion
			expect(await cache.get('session:abc123')).toBeNull()
			expect(await cache.get('session:def456')).toBeNull()
			// Other keys should remain
			expect(await cache.get('user:123')).not.toBeNull()
		})

		it('Should delete keys matching pattern using keys command', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const deletedCount = await cache.deleteByPattern('temp:*', false) // Use keys instead of scan
			expect(deletedCount).toBe(2)

			// Verify deletion
			expect(await cache.get('temp:cache:1')).toBeNull()
			expect(await cache.get('temp:cache:2')).toBeNull()
		})

		it('Should return 0 when no keys match pattern for deletion', async () => {
			const cache = createCache()
			await setupTestData(cache)

			const deletedCount = await cache.deleteByPattern('nonexistent:*')
			expect(deletedCount).toBe(0)
		})

		it('Should handle partial pattern matches in deleteByPattern', async () => {
			const cache = createCache()
			await cache.clear()
			await cache.set('prefix:test:1', 'value1')
			await cache.set('prefix:test:2', 'value2')
			await cache.set('prefix:prod:1', 'value3')

			const deletedCount = await cache.deleteByPattern('prefix:test:*')
			expect(deletedCount).toBe(2)

			// Verify correct deletion
			expect(await cache.get('prefix:test:1')).toBeNull()
			expect(await cache.get('prefix:test:2')).toBeNull()
			expect(await cache.get('prefix:prod:1')).not.toBeNull() // Should remain
		})
	})

	describe('Pattern methods with namespaces', () => {
		it('Should work correctly with custom namespace', async () => {
			const cache = createCache({ namespace: 'myapp' })
			await cache.clear()
			await cache.set('user:1', 'John')
			await cache.set('user:2', 'Jane')
			await cache.set('order:1', 'Order data')

			const userKeys = await cache.scan('user:*')
			expect(userKeys).toHaveLength(2)
			expect(userKeys).toContain('user:1')
			expect(userKeys).toContain('user:2')

			const userData = await cache.getByPattern('user:*')
			expect(userData['user:1']).toBe('John')
			expect(userData['user:2']).toBe('Jane')
		})

		it('Should work with empty namespace', async () => {
			const cache = createCache({ namespace: '' })
			await cache.clear()
			await cache.set('global:key1', 'value1')
			await cache.set('global:key2', 'value2')

			const keys = await cache.scan('global:*')
			expect(keys).toHaveLength(2)
			expect(keys).toContain('global:key1')
			expect(keys).toContain('global:key2')
		})
	})

	describe('Pattern methods edge cases', () => {
		it('Should handle special Redis pattern characters', async () => {
			const cache = createCache({ namespace: 'test' })
			await cache.clear()
			await cache.set('test-bracket', 'bracket value')
			await cache.set('test*star', 'star value')
			await cache.set('test?question', 'question value')
			await cache.set('test_underscore', 'underscore value')

			// Test that wildcard patterns work correctly
			const starKeys = await cache.keys('test*')
			expect(starKeys).toHaveLength(4)
			expect(starKeys).toContain('test-bracket')
			expect(starKeys).toContain('test*star')
			expect(starKeys).toContain('test?question')
			expect(starKeys).toContain('test_underscore')
		})

		it('Should handle very long patterns', async () => {
			const cache = createCache()
			await cache.clear()
			const longPrefix = 'very:long:prefix:with:many:levels:and:more:levels'
			await cache.set(`${longPrefix}:key1`, 'value1')
			await cache.set(`${longPrefix}:key2`, 'value2')

			const keys = await cache.scan(`${longPrefix}:*`)
			expect(keys).toHaveLength(2)
		})

		it('Should handle concurrent pattern operations', async () => {
			const cache = createCache()
			await cache.clear()

			// Set up test data
			const promises = []
			for (let i = 0; i < 100; i++) {
				promises.push(cache.set(`bulk:${i}`, `value${i}`))
			}
			await Promise.all(promises)

			// Test concurrent pattern operations
			const [scanResult, keysResult, getResult] = await Promise.all([
				cache.scan('bulk:*'),
				cache.keys('bulk:*'),
				cache.getByPattern('bulk:*'),
			])

			expect(scanResult).toHaveLength(100)
			expect(keysResult).toHaveLength(100)
			expect(Object.keys(getResult)).toHaveLength(100)
		})
	})
})

describe('Connection Operations', () => {
	it('Should ping Redis server without message', async () => {
		const cache = createCache()
		const result = await cache.ping()
		expect(result).toBe('PONG')
	})

	it('Should ping Redis server with custom message', async () => {
		const cache = createCache()
		const message = 'Hello Redis'
		const result = await cache.ping(message)
		expect(result).toBe(message)
	})

	it('Should check if Redis connection is established', async () => {
		const cache = createCache()
		const isConnected = await cache.isConnected()
		expect(isConnected).toBe(true)
	})

	it('Should verify connection status with redis URL', async () => {
		const cache = createCache({ redisUrl })
		const isConnected = await cache.isConnected()
		expect(isConnected).toBe(true)
	})

	it('Should verify connection status with namespace', async () => {
		const cache = createCache({ namespace: 'connection-test' })
		const isConnected = await cache.isConnected()
		expect(isConnected).toBe(true)
	})

	it('Should ping multiple times successfully', async () => {
		const cache = createCache()
		const results = await Promise.all([cache.ping(), cache.ping(), cache.ping()])

		results.forEach((result) => {
			expect(result).toBe('PONG')
		})
	})

	it('Should handle ping with empty string message', async () => {
		const cache = createCache()
		const result = await cache.ping('')
		expect(result).toBe('')
	})

	it('Should return false when the Redis client is closed', async () => {
		const cache = createCache()
		await cache.ping()
		cache.redisClient.close()

		expect(await cache.isConnected()).toBe(false)
	})
})

describe('Cache Value Serialization', () => {
	for (const method of ['set', 'setForever', 'setIfNotExists'] as const) {
		describe(method, () => {
			it.each(['', '123', 'true', 'null', '{"name":"John"}', '[1,2]', '"quoted"'])(
				'Should preserve the string %j without changing its type',
				async (value) => {
					const cache = createCache()
					await cache[method]('value', value)

					expect(await cache.get<string>('value')).toBe(value)
				}
			)

			it.each([null, undefined])('Should consistently read %j as null', async (value) => {
				const cache = createCache()
				await cache[method]('value', value)

				expect(await cache.get('value')).toBeNull()
				expect(await cache.exists('value')).toBe(true)
			})
		})
	}

	it('Should read existing raw Redis strings and JSON values', async () => {
		const cache = createCache()
		await testRedis.mset('raw', 'hello', 'empty', '', 'number', '42', 'object', '{"active":true}')

		expect(await cache.get<string>('raw')).toBe('hello')
		expect(await cache.get<string>('empty')).toBe('')
		expect(await cache.get<number>('number')).toBe(42)
		expect(await cache.get<{ active: boolean }>('object')).toEqual({ active: true })
	})

	it('Should cache objects without a prototype when debug mode is enabled', async () => {
		spyOn(console, 'debug').mockImplementation(() => undefined)
		const cache = createCache({ enableDebug: true })
		const value = Object.assign(Object.create(null), { name: 'John' })
		await cache.set('expiring', value)
		await cache.setForever('forever', value)

		expect(await cache.get<{ name: string }>('expiring')).toEqual({ name: 'John' })
		expect(await cache.get<{ name: string }>('forever')).toEqual({ name: 'John' })
	})
})

describe('Conditional Cache Operations', () => {
	for (const method of ['set', 'setIfNotExists', 'getOrSet'] as const) {
		it(`Should reject invalid expiration in ${method} before writing`, async () => {
			const cache = createCache()

			await expect(cache[method]('invalid', 'value', 0)).rejects.toThrow(RangeError)
			expect(await cache.exists('invalid')).toBe(false)
		})
	}

	it('Should allow only one concurrent setIfNotExists writer', async () => {
		const cache = createCache({ namespace: 'atomic' })
		const results = await Promise.all(
			Array.from({ length: 40 }, (_, index) => cache.setIfNotExists('key', index, 60))
		)

		expect(results.filter((result) => result === 'OK')).toHaveLength(1)
		expect(results.filter((result) => result === 'EXIST')).toHaveLength(39)
		expect(await cache.get<number>('key')).toBe(results.indexOf('OK'))
		expect(await cache.ttl('key')).toBeGreaterThan(0)
	})

	it('Should preserve an existing value and expiry in setIfNotExists', async () => {
		const cache = createCache()
		await cache.set('key', false, 30)

		expect(await cache.setIfNotExists('key', true, 300)).toBe('EXIST')
		expect(await cache.get<boolean>('key')).toBe(false)
		expect(await cache.ttl('key')).toBeLessThanOrEqual(30)
	})

	for (const method of ['getOrSet', 'getOrSetForever'] as const) {
		describe(method, () => {
			it.each([false, 0, '', null])('Should preserve the cached value %j and its expiry', async (value) => {
				const cache = createCache()
				await cache.set('key', value, 30)

				expect(await cache[method]<unknown>('key', 'fallback')).toBe(value)
				expect(await cache.get<typeof value>('key')).toBe(value)
				expect(await cache.ttl('key')).toBeGreaterThan(0)
				expect(await cache.ttl('key')).toBeLessThanOrEqual(30)
			})

			it('Should return the same stored value to concurrent callers', async () => {
				const cache = createCache({ namespace: 'atomic' })
				const results = await Promise.all(Array.from({ length: 40 }, (_, index) => cache[method]('key', index)))

				expect(new Set(results).size).toBe(1)
				expect(await cache.get<number>('key')).toBe(results[0])
			})

			it('Should not serialize an unused fallback on a cache hit', async () => {
				const cache = createCache()
				await cache.set('key', 'cached')
				const fallback: { self?: unknown } = {}
				fallback.self = fallback

				expect(await cache[method]<unknown>('key', fallback)).toBe('cached')
			})
		})
	}

	it('Should store getOrSetForever fallback values without an expiry', async () => {
		const cache = createCache({ expiresIn: 1 })

		expect(await cache.getOrSetForever('key', 'fallback')).toBe('fallback')
		expect(await cache.ttl('key')).toBe(-1)
	})

	it('Should set an expiry on a getOrSet fallback', async () => {
		const cache = createCache()

		expect(await cache.getOrSet('key', 'fallback', 60)).toBe('fallback')
		expect(await cache.ttl('key')).toBeGreaterThan(0)
		expect(await cache.ttl('key')).toBeLessThanOrEqual(60)
	})

	it('Should increment concurrently without losing the initial expiry', async () => {
		const cache = createCache({ namespace: 'atomic' })
		const results = await Promise.all(Array.from({ length: 40 }, () => cache.incrementWithExpiry('counter', 60)))

		expect([...results].sort((a, b) => a - b)).toEqual(Array.from({ length: 40 }, (_, index) => index + 1))
		expect(await cache.get<number>('counter')).toBe(40)
		expect(await cache.ttl('counter')).toBeGreaterThan(0)
	})

	it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
		'Should reject invalid counter expiry %j before changing the key',
		async (expiresIn) => {
			const cache = createCache()

			await expect(cache.incrementWithExpiry('counter', expiresIn)).rejects.toThrow()
			expect(await cache.exists('counter')).toBe(false)
		}
	)

	it('Should leave non-numeric counters unchanged on increment failure', async () => {
		const cache = createCache()
		await cache.setForever('counter', 'not a number')

		await expect(cache.incrementWithExpiry('counter', 60)).rejects.toThrow()
		expect(await cache.get<string>('counter')).toBe('not a number')
		expect(await cache.ttl('counter')).toBe(-1)
	})
})

describe('Configuration and Connection Lifecycle', () => {
	it('Should expose the configured native Redis options', () => {
		const redisOptions = { connectionTimeout: 2000, autoReconnect: false }
		const cache = createCache({ redisUrl, redisOptions })

		expect(cache.redisOptions).toEqual(redisOptions)
	})

	it('Should preserve the connection and existing settings during partial configuration', async () => {
		const redisOptions = { connectionTimeout: 2000 }
		const cache = createCache({ redisUrl, redisOptions, namespace: 'old', expiresIn: 60 })
		const client = cache.redisClient
		await cache.ping()

		expect(cache.configure({ namespace: 'new' })).toBe(cache)
		expect(cache.redisClient).toBe(client)
		expect(cache.redisUrl).toBe(redisUrl)
		expect(cache.redisOptions).toEqual(redisOptions)
		expect(cache.expiresIn).toBe(60)
		expect(cache.namespace).toBe('new')
		expect(await cache.ping()).toBe('PONG')
	})

	it('Should close an owned Redis client when replacing it', async () => {
		const cache = createCache({ redisUrl })
		const client = cache.redisClient
		await cache.ping()
		const onclose = mock()
		client.onclose = onclose

		cache.configure({ redisUrl })

		expect(cache.redisClient).not.toBe(client)
		await expect(client.ping()).rejects.toThrow()
		expect(onclose).not.toHaveBeenCalled()
		expect(await cache.ping()).toBe('PONG')
	})

	it('Should leave an injected Redis client open when replacing it', async () => {
		const sharedClient = new RedisClient(redisUrl)
		try {
			const cache = createCache({ redisClient: sharedClient })
			await cache.ping()
			cache.configure({ redisUrl })

			expect(await sharedClient.ping()).toBe('PONG')
			expect(await cache.ping()).toBe('PONG')
		} finally {
			sharedClient.close()
		}
	})

	it('Should not close a client when configuring the same client again', async () => {
		const redisOptions = { connectionTimeout: 2000 }
		const cache = createCache({ redisUrl, redisOptions })
		const client = cache.redisClient
		await cache.ping()
		cache.configure({ redisClient: client })

		expect(cache.redisClient).toBe(client)
		expect(cache.redisUrl).toBe(redisUrl)
		expect(cache.redisOptions).toEqual(redisOptions)
		expect(await cache.ping()).toBe('PONG')
	})

	it('Should preserve the Redis URL when replacing only native options', async () => {
		const cache = createCache({ redisUrl })
		const redisOptions = { connectionTimeout: 2000 }
		cache.configure({ redisOptions })

		expect(cache.redisUrl).toBe(redisUrl)
		expect(cache.redisOptions).toEqual(redisOptions)
		expect(await cache.ping()).toBe('PONG')
	})

	it('Should clear old connection metadata when injecting a different client', () => {
		const cache = createCache({ redisUrl, redisOptions: { connectionTimeout: 2000 } })
		const external = new RedisClient(redisUrl)
		cache.configure({ redisClient: external })

		expect(cache.redisClient).toBe(external)
		expect(cache.redisUrl).toBeUndefined()
		expect(cache.redisOptions).toBeUndefined()
	})

	it('Should reject invalid default expiration before creating a cache', () => {
		expect(() => createCache({ expiresIn: 0 })).toThrow(RangeError)
	})

	it('Should preserve configuration when an update has invalid expiration', () => {
		const cache = createCache({ namespace: 'original', expiresIn: 60 })
		const client = cache.redisClient

		expect(() => cache.configure({ namespace: 'changed', expiresIn: 0, redisUrl })).toThrow(RangeError)
		expect(cache.redisClient).toBe(client)
		expect(cache.namespace).toBe('original')
		expect(cache.expiresIn).toBe(60)
	})
})

describe('Pattern Operation Edge Cases', () => {
	it.each([0, -1, 1.5, NaN, Infinity])('Should reject an invalid SCAN count %j', async (count) => {
		const cache = createCache()

		await expect(cache.scan('*', count)).rejects.toThrow(RangeError)
	})

	it('Should accept an empty deletion list without contacting Redis', async () => {
		const cache = createCache()
		cache.redisClient.close()

		await expect(cache.deleteMany([])).resolves.toBeUndefined()
	})

	it('Should clear all keys when the namespace is empty', async () => {
		const cache = createCache()
		await cache.setForever('plain', 'one')
		await cache.setForever('nested:key', 'two')
		await cache.clear()

		expect(await testRedis.send('DBSIZE', [])).toBe(0)
	})

	it.each([
		['app*', 'application'],
		['app?', 'apps'],
		['app[1]', 'app1'],
		['app\\', 'app'],
	])('Should treat the namespace %s literally in pattern operations', async (namespace, neighbor) => {
		const cache = createCache({ namespace })
		await cache.setForever('key', 'data')
		await testRedis.set(`${neighbor}:outside`, 'untouched')

		expect(await cache.keys('*')).toEqual(['key'])
		expect(await cache.scan('*', 1)).toEqual(['key'])
		expect(await cache.getByPattern('*')).toEqual({ key: 'data' })
		expect(await cache.deleteByPattern('*')).toBe(1)
		expect(await testRedis.get(`${neighbor}:outside`)).toBe('untouched')

		await cache.setForever('key', 'data')
		await cache.clear()
		expect(await cache.get('key')).toBeNull()
		expect(await testRedis.get(`${neighbor}:outside`)).toBe('untouched')
	})

	it('Should accept already-prefixed patterns without duplicating the namespace', async () => {
		const cache = createCache({ namespace: 'app' })
		await cache.set('key', 'value')

		expect(await cache.scan('app:*')).toEqual(['key'])
		expect(await cache.keys('app:*')).toEqual(['key'])
	})

	it('Should use full Redis keys when a key repeats the namespace', async () => {
		const cache = createCache({ namespace: 'app' })
		await testRedis.mset('app:app:key', 'nested', 'app:key', 'plain')

		expect((await cache.scan('*')).sort()).toEqual(['app:key', 'key'])
		expect(await cache.getByPattern('*')).toEqual({ 'app:key': 'nested', 'key': 'plain' })
		expect(await cache.deleteByPattern('app:app:*')).toBe(1)
		expect(await testRedis.get('app:app:key')).toBeNull()
		expect(await testRedis.get('app:key')).toBe('plain')
	})

	it('Should safely return keys named __proto__', async () => {
		const cache = createCache()
		await cache.set('__proto__', { value: 'cached' })
		const result = await cache.getByPattern('*')

		expect(Object.hasOwn(result, '__proto__')).toBe(true)
		expect(result['__proto__']).toEqual({ value: 'cached' })
		expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
	})

	it('Should return null for non-string Redis keys during pattern reads', async () => {
		const cache = createCache()
		await cache.set('mixed:value', 'cached')
		await testRedis.sadd('mixed:set', 'member')

		expect(await cache.getByPattern('mixed:*')).toEqual({ 'mixed:value': 'cached', 'mixed:set': null })
	})

	it('Should deduplicate SCAN results and continue after empty pages', async () => {
		const cache = createCache({ namespace: 'app' })
		spyOn(cache.redisClient, 'scan')
			.mockResolvedValueOnce(['1', []])
			.mockResolvedValueOnce(['2', ['app:first', 'app:second']])
			.mockResolvedValueOnce(['0', ['app:first']])

		expect(await cache.scan('*')).toEqual(['first', 'second'])
	})

	it('Should finish deleting each SCAN page before requesting the next page', async () => {
		const cache = createCache({ namespace: 'app' })
		await testRedis.mset('app:first', 'one', 'app:second', 'two')
		spyOn(cache.redisClient, 'scan')
			.mockResolvedValueOnce(['1', ['app:first']])
			.mockImplementationOnce(async () => {
				expect(await testRedis.exists('app:first')).toBe(false)
				expect(await testRedis.exists('app:second')).toBe(true)
				return ['0', ['app:second']]
			})

		expect(await cache.deleteByPattern('*')).toBe(2)
		expect(await testRedis.exists('app:second')).toBe(false)
	})

	it('Should stop scanning and propagate a failed page read', async () => {
		const cache = createCache({ namespace: 'app' })
		const scan = spyOn(cache.redisClient, 'scan')
			.mockResolvedValueOnce(['1', ['app:first']])
			.mockResolvedValueOnce(['0', ['app:second']])
		const error = new Error('Failed to read a page')
		spyOn(cache.redisClient, 'mget').mockRejectedValueOnce(error)

		await expect(cache.getByPattern('*')).rejects.toThrow(error)
		expect(scan).toHaveBeenCalledTimes(1)
	})

	it('Should propagate a failed pattern read when using KEYS', async () => {
		const cache = createCache({ namespace: 'app' })
		await cache.set('first', 'one')
		const error = new Error('Failed to read matching keys')
		spyOn(cache.redisClient, 'mget').mockRejectedValueOnce(error)

		await expect(cache.getByPattern('*', false)).rejects.toThrow(error)
	})

	it('Should report only keys actually deleted when a key disappears after SCAN', async () => {
		const cache = createCache({ namespace: 'app' })
		spyOn(cache.redisClient, 'scan').mockResolvedValueOnce(['0', ['app:expired']])

		expect(await cache.deleteByPattern('*')).toBe(0)
	})

	it.each([true, false])('Should retrieve and delete large batches with useScan=%s', async (useScan) => {
		const cache = createCache({ namespace: 'bulk' })
		const size = 1205
		await testRedis.mset(
			...Array.from({ length: size }, (_, index) => [`bulk:item:${index}`, String(index)]).flat()
		)
		await testRedis.set('other:keep', 'untouched')

		const values = await cache.getByPattern<number>('item:*', useScan)
		expect(Object.keys(values)).toHaveLength(size)
		for (let index = 0; index < size; index++) expect(values[`item:${index}`]).toBe(index)
		expect(await cache.deleteByPattern('item:*', useScan)).toBe(size)
		expect(await cache.scan('*')).toEqual([])
		expect(await testRedis.get('other:keep')).toBe('untouched')
	})

	it('Should clear a large namespace while keeping neighboring namespaces', async () => {
		const cache = createCache({ namespace: 'bulk' })
		await testRedis.mset(...Array.from({ length: 1205 }, (_, index) => [`bulk:${index}`, String(index)]).flat())
		await testRedis.set('other:keep', 'untouched')
		await cache.clear()

		expect(await cache.scan('*')).toEqual([])
		expect(await testRedis.get('other:keep')).toBe('untouched')
	})

	it('Should handle bulk operations across multiple windows of pending commands', async () => {
		const cache = createCache({ namespace: 'bulk' })
		const size = 16_505
		const keys = Array.from({ length: size }, (_, index) => `item:${index}`)
		for (let start = 0; start < size; start += 500) {
			const entries = keys.slice(start, start + 500).flatMap((key) => [`bulk:${key}`, key])
			await testRedis.mset(...entries)
		}

		const values = await cache.getByPattern<string>('item:*', false)
		expect(Object.keys(values)).toHaveLength(size)
		expect(values['item:0']).toBe('item:0')
		expect(values[`item:${size - 1}`]).toBe(`item:${size - 1}`)
		await cache.deleteMany(keys)
		expect(await cache.scan('*')).toEqual([])
	})
})
