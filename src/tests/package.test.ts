import { RedisClient } from 'bun'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import CacheXS from '../index'

const redisUrl = 'redis://localhost:6379'

describe('Create Cache Instance', () => {
	beforeAll(async () => {
		const cache = new CacheXS()
		await cache.clear()
	})

	afterAll(async () => {
		const cache = new CacheXS()
		await cache.clear()
	})

	it('Should create a new instance for Cache class with default configuration', async () => {
		const cache = new CacheXS()

		expect(cache).toBeInstanceOf(CacheXS)
		expect(cache.namespace).toStrictEqual('cacheXS')
		expect(cache.expiresIn).toStrictEqual(300)
		expect(cache.isDebugEnabled).toStrictEqual(false)
	})

	it('Should create a new instance for Cache class with redis connection', async () => {
		const bunRedis = new RedisClient(redisUrl)

		const cache = new CacheXS({
			redisClient: bunRedis,
		})

		expect(cache).toBeInstanceOf(CacheXS)
		expect(cache.namespace).toStrictEqual('cacheXS')
		expect(cache.expiresIn).toStrictEqual(300)
		expect(cache.isDebugEnabled).toStrictEqual(false)
	})

	it('Should create a new instance for Cache class with redis url', async () => {
		const cache = new CacheXS({
			redisUrl,
		})

		expect(cache).toBeInstanceOf(CacheXS)
		expect(cache.redisUrl).toBe(redisUrl)
	})

	it('Should create a new instance for Cache class and configure it later', async () => {
		const cache = new CacheXS()
		cache.configure({ redisUrl })
		expect(cache).toBeInstanceOf(CacheXS)
		expect(cache.redisUrl).toBe(redisUrl)
	})

	it('Should create a new instance for Cache class and change the default cache namespace', async () => {
		const cache = new CacheXS({
			namespace: 'test',
		})
		await cache.set('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')
	})

	it('Should create a new instance for Cache class and change the default expires in seconds', async () => {
		const cache = new CacheXS({
			expiresIn: 1,
		})
		await cache.set('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')
		await new Promise((resolve) => setTimeout(resolve, 1000))
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should get the cache class instance details', async () => {
		const cache = new CacheXS()
		expect(cache).toBeInstanceOf(CacheXS)
		// expect(cache.redisConfig).toMatchObject(redisConfig)
		expect(cache.redisUrl).toBeUndefined()
		expect(cache.expiresIn).toBe(300)
		expect(cache.namespace).toBe('cacheXS')
		expect(cache.isDebugEnabled).toBe(false)
	})

	it('Should test the concatenateKey method', async () => {
		const cache = new CacheXS()
		expect(cache.concatenateKey('foo')).toBe('cacheXS:foo')
		expect(cache.concatenateKey('foo:bar')).toBe('cacheXS:foo:bar')
	})
})

describe('Set Cache', () => {
	it('Should set a value in cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')
	})

	it('Should set a value with object in cache', async () => {
		const cache = new CacheXS()

		const object = { name: 'John', age: 30 }
		await cache.set('foo', object)
		const value = await cache.get<typeof object>('foo')
		expect(value).toStrictEqual(object)
	})

	it('Should set a value with number in cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 123)
		const value = await cache.get<number>('foo')
		expect(value).toBe(123)
	})

	it('Should set a value with string in cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar')
		const value = await cache.get<string>('foo')
		expect(value).toBe('bar')
	})

	it('Should set a value with boolean in cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', true)
		const value = await cache.get<boolean>('foo')

		expect(value).toBe(true)
	})

	it('Should set a value with null in cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', null)
		const value = await cache.get<null>('foo')
		expect(value).toBeNull()
	})

	it('Should set a value with undefined in cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', undefined)
		const value = await cache.get<undefined>('foo')
		expect(value).toBeNull()
	})

	it('Should set a value in cache with nested namespace', async () => {
		const cache = new CacheXS()
		await cache.set('foo:bar', 'baz')
		const value = await cache.get('foo:bar')
		expect(value).toBe('baz')
	})

	it('Should set a value in cache with expiration', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar', 1)
		const value = await cache.get('foo')
		expect(value).toBe('bar')
		await new Promise((resolve) => setTimeout(resolve, 1000))
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should set a value in cache forever', async () => {
		const cache = new CacheXS()
		await cache.setForever('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')
	})

	it('Should set a value in cache forever with nested namespace', async () => {
		const cache = new CacheXS()
		await cache.setForever('foo:bar', 'baz')
		const value = await cache.get('foo:bar')
		expect(value).toBe('baz')
	})

	it('Should set a value in cache if it does not exist', async () => {
		const cache = new CacheXS()
		await cache.setIfNotExists('foo', 'bar')
		const value = await cache.get<string>('foo')
		expect(value).toBe('bar')
	})

	it('Should set a value in cache if it does not exist with nested namespace', async () => {
		const cache = new CacheXS()

		const result = await cache.setIfNotExists('foo:foo:bar', 'baz')
		expect(result).toBe('OK')
		const value = await cache.get<string>('foo:foo:bar')
		expect(value).toBe('baz')
	})

	it('Should not set a value in cache if already exists', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar')
		const result = await cache.setIfNotExists('foo', 'zoo')
		expect(result).toBe('EXIST')
		const value = await cache.get<string>('foo')
		expect(value).toBe('bar')
	})
})

describe('Get Cache', () => {
	it('Should get a value from cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')
	})

	it('Should get a value from cache with nested namespace', async () => {
		const cache = new CacheXS()
		await cache.set('foo:bar', 'baz')
		const value = await cache.get('foo:bar')
		expect(value).toBe('baz')
	})

	it('Should get a value from cache with expiration', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar', 1)
		const value = await cache.get('foo')
		expect(value).toBe('bar')
		await new Promise((resolve) => setTimeout(resolve, 1000))
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should get a value from cache forever', async () => {
		const cache = new CacheXS()
		await cache.setForever('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')
	})

	it('Should get a value from cache forever with namespace', async () => {
		const cache = new CacheXS()
		await cache.setForever('foo:bar', 'baz')
		const value = await cache.get('foo:bar')
		expect(value).toBe('baz')
	})

	it('Should check if the key is exists in cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar')
		const isExists = await cache.exists('foo')
		expect(isExists).toBe(true)
	})

	it('Should check if the key is missing in cache', async () => {
		const cache = new CacheXS()
		const isMissing = await cache.missing('foo')
		expect(isMissing).toBe(false)
	})
})

describe('Other Helpers', () => {
	it('Should expire a key after a certain time', async () => {
		const cache = new CacheXS()

		await cache.set('foo', 'bar', 5)
		await cache.expire('foo', 1)
		const value = await cache.get('foo')
		expect(value).toBe('bar')
		await new Promise((resolve) => setTimeout(resolve, 1000))
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should expire a key immediately', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar', 5)
		await cache.expireNow('foo')
		const value = await cache.get('foo')
		expect(value).toBeNull()
	})

	it('Should get the time to live for a key', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar', 1)
		const ttl = await cache.ttl('foo')
		expect(ttl).toBe(1)
	})

	it('Should increment the value of a key by one', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 0)
		const value = await cache.increment('foo')
		expect(value).toBe(1)
	})

	it('Should decrement the value of a key by one', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 1)
		const value = await cache.decrement('foo')
		expect(value).toBe(0)
	})
})

describe('Delete & Clear Cache', () => {
	it('Should delete an item from cache', async () => {
		const cache = new CacheXS()

		await cache.set('foo', 'bar')
		const value = await cache.get('foo')
		expect(value).toBe('bar')

		await cache.delete('foo')

		const valueAfterDelete = await cache.get('foo')
		expect(valueAfterDelete).toBeNull()
	})

	it('Should delete an item from cache with nested namespace', async () => {
		const cache = new CacheXS({ namespace: 'test' })

		await cache.set('foo:bar', 'baz')
		const value = await cache.get('foo:bar')
		expect(value).toBe('baz')

		await cache.delete('foo:bar')
		const valueAfterDelete = await cache.get('foo:bar')
		expect(valueAfterDelete).toBeNull()
	})

	it('Should delete many items from cache', async () => {
		const cache = new CacheXS()

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
		const cache = new CacheXS()

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
			const cache = new CacheXS()
			await setupTestData(cache)

			const userKeys = await cache.scan('user:*')
			expect(userKeys).toHaveLength(3)
			expect(userKeys).toContain('user:123')
			expect(userKeys).toContain('user:456')
			expect(userKeys).toContain('user:789')
		})

		it('Should find keys with nested pattern using scan', async () => {
			const cache = new CacheXS()
			await setupTestData(cache)

			const tempKeys = await cache.scan('temp:cache:*')
			expect(tempKeys).toHaveLength(2)
			expect(tempKeys).toContain('temp:cache:1')
			expect(tempKeys).toContain('temp:cache:2')
		})

		it('Should handle custom count parameter in scan', async () => {
			const cache = new CacheXS()
			await setupTestData(cache)

			const userKeys = await cache.scan('user:*', 1)
			expect(userKeys).toHaveLength(3) // Should still find all keys despite small count
		})

		it('Should return empty array when no keys match pattern in scan', async () => {
			const cache = new CacheXS()
			await setupTestData(cache)

			const nonExistentKeys = await cache.scan('nonexistent:*')
			expect(nonExistentKeys).toHaveLength(0)
		})

		it('Should work with different namespaces in scan', async () => {
			const cache = new CacheXS({ namespace: 'testapp' })
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
			const cache = new CacheXS()
			await setupTestData(cache)

			const sessionKeys = await cache.keys('session:*')
			expect(sessionKeys).toHaveLength(2)
			expect(sessionKeys).toContain('session:abc123')
			expect(sessionKeys).toContain('session:def456')
		})

		it('Should find keys with wildcard patterns', async () => {
			const cache = new CacheXS()
			await setupTestData(cache)

			const configKeys = await cache.keys('config:*')
			expect(configKeys).toHaveLength(2)
			expect(configKeys).toContain('config:app')
			expect(configKeys).toContain('config:db')
		})

		it('Should return empty array when no keys match in keys method', async () => {
			const cache = new CacheXS()
			await setupTestData(cache)

			const emptyResult = await cache.keys('missing:*')
			expect(emptyResult).toHaveLength(0)
		})

		it('Should work with single character wildcards', async () => {
			const cache = new CacheXS()
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
			const cache = new CacheXS()
			await setupTestData(cache)

			const userData = await cache.getByPattern<{ name: string; age: number }>('user:*')
			expect(Object.keys(userData)).toHaveLength(3)
			expect(userData['user:123']).toEqual({ name: 'John', age: 30 })
			expect(userData['user:456']).toEqual({ name: 'Jane', age: 25 })
			expect(userData['user:789']).toEqual({ name: 'Bob', age: 35 })
		})

		it('Should retrieve multiple values by pattern using keys command', async () => {
			const cache = new CacheXS()
			await setupTestData(cache)

			const configData = await cache.getByPattern('config:*', false) // Use keys instead of scan
			expect(Object.keys(configData)).toHaveLength(2)
			expect(configData['config:app']).toEqual({ theme: 'dark', lang: 'en' })
			expect(configData['config:db']).toEqual({ host: 'localhost', port: 5432 })
		})

		it('Should handle mixed data types in getByPattern', async () => {
			const cache = new CacheXS()
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
			const cache = new CacheXS()
			await setupTestData(cache)

			const emptyResult = await cache.getByPattern('nonexistent:*')
			expect(Object.keys(emptyResult)).toHaveLength(0)
		})

		it('Should handle null values in getByPattern', async () => {
			const cache = new CacheXS()
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
			const cache = new CacheXS()
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
			const cache = new CacheXS()
			await setupTestData(cache)

			const deletedCount = await cache.deleteByPattern('temp:*', false) // Use keys instead of scan
			expect(deletedCount).toBe(2)

			// Verify deletion
			expect(await cache.get('temp:cache:1')).toBeNull()
			expect(await cache.get('temp:cache:2')).toBeNull()
		})

		it('Should return 0 when no keys match pattern for deletion', async () => {
			const cache = new CacheXS()
			await setupTestData(cache)

			const deletedCount = await cache.deleteByPattern('nonexistent:*')
			expect(deletedCount).toBe(0)
		})

		it('Should handle partial pattern matches in deleteByPattern', async () => {
			const cache = new CacheXS()
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
			const cache = new CacheXS({ namespace: 'myapp' })
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
			const cache = new CacheXS({ namespace: '' })
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
			const cache = new CacheXS()
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
			const cache = new CacheXS()
			await cache.clear()
			const longPrefix = 'very:long:prefix:with:many:levels:and:more:levels'
			await cache.set(`${longPrefix}:key1`, 'value1')
			await cache.set(`${longPrefix}:key2`, 'value2')

			const keys = await cache.scan(`${longPrefix}:*`)
			expect(keys).toHaveLength(2)
		})

		it('Should handle concurrent pattern operations', async () => {
			const cache = new CacheXS()
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
