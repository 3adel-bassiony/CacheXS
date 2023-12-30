import { Redis } from 'ioredis'
import { describe, expect, it } from 'vitest'

import Cache from '../index'

const redisConfig = {
	host: 'localhost',
	port: 6379,
	password: '',
}

const redisUrl = 'redis://localhost:6379'

describe('Create Cache Instance', () => {
	it('Should create a new instance for Cache class with default configuration', async () => {
		const cache = new Cache()

		expect(cache).toBeInstanceOf(Cache)
		expect(cache.redisConfig).toStrictEqual(redisConfig)
	})

	it('Should create a new instance for Cache class with redis connection', async () => {
		const cache = new Cache({
			redisConnection: new Redis(redisConfig),
		})

		expect(cache).toBeInstanceOf(Cache)
		expect(cache.redisConfig).toMatchObject(redisConfig)
	})

	it('Should create a new instance for Cache class with redis configuration', async () => {
		const cache = new Cache({ redisConfig })
		expect(cache).toBeInstanceOf(Cache)
		expect(cache.redisConfig).toMatchObject(redisConfig)
	})

	it('Should create a new instance for Cache class with redis url', async () => {
		const cache = new Cache({
			redisUrl,
		})

		expect(cache).toBeInstanceOf(Cache)
		expect(cache.redisUrl).toBe(redisUrl)
	})

	it('Should create a new instance for Cache class and configure it later', async () => {
		const cache = new Cache()
		cache.configure({ redisUrl })
		expect(cache).toBeInstanceOf(Cache)
		expect(cache.redisUrl).toBe(redisUrl)
	})

	it('Should create a new instance for Cache class and change the default cache namespace', async () => {
		const cache = new Cache({
			cacheNamespace: 'test',
		})
		await cache.set('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
	})

	it('Should create a new instance for Cache class and change the default expires in seconds', async () => {
		const cache = new Cache({
			defaultExpiresIn: 1,
		})
		await cache.set('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
		await new Promise((resolve) => setTimeout(resolve, 1000))
		expect(await cache.get('foo')).toBeNull()
	})
})

describe('Set Cache', () => {
	it('Should set a value in cache', async () => {
		const cache = new Cache()
		await cache.set('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
	})

	it('Should set a value in cache with namespace', async () => {
		const cache = new Cache()
		await cache.set('foo', 'bar', { namespace: 'namespace' })
		expect(await cache.get('foo', 'namespace')).toBe('bar')
	})

	it('Should set a value in cache with namespace and expiration', async () => {
		const cache = new Cache()
		await cache.set('foo', 'bar', { namespace: 'namespace', expiresIn: 1 })
		expect(await cache.get('foo', 'namespace')).toBe('bar')
		await new Promise((resolve) => setTimeout(resolve, 1000))
		expect(await cache.get('foo', 'namespace')).toBeNull()
	})

	it('Should set a value in cache forever', async () => {
		const cache = new Cache()
		await cache.setForever('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
	})

	it('Should set a value in cache forever with namespace', async () => {
		const cache = new Cache()
		await cache.setForever('foo', 'bar', { namespace: 'namespace' })
		expect(await cache.get('foo', 'namespace')).toBe('bar')
	})
})

describe('Get Cache', () => {
	it('Should get a value from cache', async () => {
		const cache = new Cache()
		await cache.set('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
	})

	it('Should get a value from cache with namespace', async () => {
		const cache = new Cache()
		await cache.set('foo', 'bar', { namespace: 'namespace' })
		expect(await cache.get('foo', 'namespace')).toBe('bar')
	})

	it('Should get a value from cache with namespace and expiration', async () => {
		const cache = new Cache()
		await cache.set('foo', 'bar', { namespace: 'namespace', expiresIn: 1 })
		expect(await cache.get('foo', 'namespace')).toBe('bar')
		await new Promise((resolve) => setTimeout(resolve, 1000))
		expect(await cache.get('foo', 'namespace')).toBeNull()
	})

	it('Should get a value from cache forever', async () => {
		const cache = new Cache()
		await cache.setForever('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
	})

	it('Should get a value from cache forever with namespace', async () => {
		const cache = new Cache()
		await cache.setForever('foo', 'bar', { namespace: 'namespace' })
		expect(await cache.get('foo', 'namespace')).toBe('bar')
	})
})

describe('Delete Cache', () => {
	it('Should delete a value from cache', async () => {
		const cache = new Cache()
		await cache.set('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
		await cache.delete('foo')
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should delete a value from cache with namespace', async () => {
		const cache = new Cache()
		await cache.set('foo', 'bar', { namespace: 'namespace' })
		expect(await cache.get('foo', 'namespace')).toBe('bar')
		await cache.delete('foo', 'namespace')
		expect(await cache.get('foo', 'namespace')).toBeNull()
	})

	it('Should delete a value from cache forever', async () => {
		const cache = new Cache()
		await cache.setForever('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
		await cache.delete('foo')
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should delete a value from cache forever with namespace', async () => {
		const cache = new Cache()
		await cache.setForever('foo', 'bar', { namespace: 'namespace' })
		expect(await cache.get('foo', 'namespace')).toBe('bar')
		await cache.delete('foo', 'namespace')
		expect(await cache.get('foo', 'namespace')).toBeNull()
	})

	it('Should delete all values from cache', async () => {
		const cache = new Cache()
		await cache.set('foo', 'bar')
		await cache.set('foo2', 'bar2')
		expect(await cache.get('foo')).toBe('bar')
		expect(await cache.get('foo2')).toBe('bar2')
		await cache.deleteAll()
		expect(await cache.get('foo')).toBeNull()
		expect(await cache.get('foo2')).toBeNull()
	})
})

describe('Should get the cache class instance details', () => {
	it('Should get the cache class instance details', async () => {
		const cache = new Cache()
		expect(cache).toBeInstanceOf(Cache)
		expect(cache.redisConfig).toMatchObject(redisConfig)
		expect(cache.redisUrl).toBeUndefined()
		expect(cache.defaultExpiresIn).toBe(300)
		expect(cache.cacheNamespace).toBe('cache')
		expect(cache.isDebugEnabled).toBe(false)
	})

	it('Should test the concatenateKeyWithNamespace method', async () => {
		const cache = new Cache()
		expect(cache.concatenateKeyWithNamespace('foo')).toBe('cache:foo')
		expect(cache.concatenateKeyWithNamespace('foo', 'namespace')).toBe('cache:namespace:foo')
	})
})
