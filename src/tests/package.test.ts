import { Redis } from 'ioredis'
import { describe, expect, it } from 'vitest'

import CacheXS from '../index'

const redisConfig = {
	host: 'localhost',
	port: 6379,
	password: '',
}

const redisUrl = 'redis://localhost:6379'

describe('Create Cache Instance', () => {
	it('Should create a new instance for Cache class with default configuration', async () => {
		const cache = new CacheXS()

		expect(cache).toBeInstanceOf(CacheXS)
		expect(cache.redisConfig).toStrictEqual(redisConfig)
	})

	it('Should create a new instance for Cache class with redis connection', async () => {
		const cache = new CacheXS({
			redisConnection: new Redis(redisConfig),
		})

		expect(cache).toBeInstanceOf(CacheXS)
		expect(cache.redisConfig).toMatchObject(redisConfig)
	})

	it('Should create a new instance for Cache class with redis configuration', async () => {
		const cache = new CacheXS({ redisConfig })
		expect(cache).toBeInstanceOf(CacheXS)
		expect(cache.redisConfig).toMatchObject(redisConfig)
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
		expect(await cache.get('foo')).toBe('bar')
	})

	it('Should create a new instance for Cache class and change the default expires in seconds', async () => {
		const cache = new CacheXS({
			expiresIn: 1,
		})
		await cache.set('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
		await new Promise((resolve) => setTimeout(resolve, 1000))
		expect(await cache.get('foo')).toBeNull()
	})
})

describe('Set Cache', () => {
	it('Should set a value in cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
	})

	it('Should set a value in cache with nested namespace', async () => {
		const cache = new CacheXS()
		await cache.set('foo:bar', 'baz')
		expect(await cache.get('foo:bar')).toBe('baz')
	})

	it('Should set a value in cache with expiration', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar', { expiresIn: 1 })
		expect(await cache.get('foo')).toBe('bar')
		await new Promise((resolve) => setTimeout(resolve, 1000))
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should set a value in cache forever', async () => {
		const cache = new CacheXS()
		await cache.setForever('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
	})

	it('Should set a value in cache forever with nested namespace', async () => {
		const cache = new CacheXS()
		await cache.setForever('foo:bar', 'baz')
		expect(await cache.get('foo:bar')).toBe('baz')
	})
})

describe('Get Cache', () => {
	it('Should get a value from cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
	})

	it('Should get a value from cache with nested namespace', async () => {
		const cache = new CacheXS()
		await cache.set('foo:bar', 'baz')
		expect(await cache.get('foo:bar')).toBe('baz')
	})

	it('Should get a value from cache with expiration', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar', { expiresIn: 1 })
		expect(await cache.get('foo')).toBe('bar')
		await new Promise((resolve) => setTimeout(resolve, 1000))
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should get a value from cache forever', async () => {
		const cache = new CacheXS()
		await cache.setForever('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
	})

	it('Should get a value from cache forever with namespace', async () => {
		const cache = new CacheXS()
		await cache.setForever('foo:bar', 'baz')
		expect(await cache.get('foo:bar')).toBe('baz')
	})

	it('Should check if the key is exists in cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar')
		expect(await cache.has('foo')).toBe(true)
	})

	it('Should check if the key is missing in cache', async () => {
		const cache = new CacheXS()
		expect(await cache.missing('foo')).toBe(false)
	})
})

describe('Delete & Clear Cache', () => {
	it('Should delete an item from cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar')
		expect(await cache.get('foo')).toBe('bar')
		await cache.delete('foo')
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should delete an item from cache with nested namespace', async () => {
		const cache = new CacheXS({ namespace: 'test' })
		await cache.set('foo:bar', 'baz')
		expect(await cache.get('foo:bar')).toBe('baz')
		await cache.delete('foo:bar')
		await cache.delete('foo')
		expect(await cache.get('foo:bar')).toBeNull()
		expect(await cache.get('foo')).toBeNull()
	})

	it('Should delete many items from cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar')
		await cache.set('foo:bar', 'baz')
		expect(await cache.get('foo')).toBe('bar')
		expect(await cache.get('foo:bar')).toBe('baz')
		await cache.deleteMany(['foo', 'foo:bar'])
		expect(await cache.get('foo')).toBeNull()
		expect(await cache.get('foo:bar')).toBeNull()
	})

	it('Should clear all cache', async () => {
		const cache = new CacheXS()
		await cache.set('foo', 'bar')
		await cache.set('foo2', 'bar2')
		expect(await cache.get('foo')).toBe('bar')
		expect(await cache.get('foo2')).toBe('bar2')
		await cache.clear()
		expect(await cache.get('foo')).toBeNull()
		expect(await cache.get('foo2')).toBeNull()
	})
})

describe('Should get the cache class instance details', () => {
	it('Should get the cache class instance details', async () => {
		const cache = new CacheXS()
		expect(cache).toBeInstanceOf(CacheXS)
		expect(cache.redisConfig).toMatchObject(redisConfig)
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
