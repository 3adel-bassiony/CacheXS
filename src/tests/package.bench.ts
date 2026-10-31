import CacheXS from '../index'

import { startRedisServer } from './redisServer'

const keyCount = Number(process.env.CACHEXS_BENCH_KEYS ?? 10_000)
const samples = Number(process.env.CACHEXS_BENCH_SAMPLES ?? 7)
if (!Number.isSafeInteger(keyCount) || keyCount <= 0 || !Number.isSafeInteger(samples) || samples <= 0) {
	throw new RangeError('CACHEXS_BENCH_KEYS and CACHEXS_BENCH_SAMPLES must be positive safe integers')
}

const server = await startRedisServer()
const cache = new CacheXS({ redisUrl: server.url, namespace: 'benchmark' })
const keys = Array.from({ length: keyCount }, (_, index) => `item:${index}`)
const entries = keys.flatMap((key, index) => [`benchmark:${key}`, JSON.stringify({ index, data: 'x'.repeat(32) })])

async function seed(): Promise<void> {
	await server.client.send('FLUSHDB', [])
	for (let index = 0; index < entries.length; index += 1000) {
		await server.client.mset(...entries.slice(index, index + 1000))
	}
}

function commandCounts(info: string): Record<string, number> {
	const counts: Record<string, number> = {}
	for (const match of info.matchAll(/^cmdstat_(get|mget|del|scan|keys):calls=(\d+)/gm)) {
		counts[match[1]] = Number(match[2])
	}
	return counts
}

const operations = [
	{ name: 'getByPattern (SCAN)', read: true, run: () => cache.getByPattern('item:*') },
	{ name: 'getByPattern (KEYS)', read: true, run: () => cache.getByPattern('item:*', false) },
	{ name: 'deleteMany', read: false, run: () => cache.deleteMany(keys) },
	{ name: 'deleteByPattern (SCAN)', read: false, run: () => cache.deleteByPattern('item:*') },
	{ name: 'deleteByPattern (KEYS)', read: false, run: () => cache.deleteByPattern('item:*', false) },
	{ name: 'clear', read: false, run: () => cache.clear() },
]
const results = []

try {
	for (const operation of operations) {
		const durations: number[] = []
		let commands: Record<string, number> = {}
		for (let sample = -2; sample < samples; sample++) {
			await seed()
			const before = commandCounts(await server.client.send('INFO', ['commandstats']))
			const start = performance.now()
			const result = await operation.run()
			const elapsed = performance.now() - start
			const after = commandCounts(await server.client.send('INFO', ['commandstats']))
			commands = Object.fromEntries(
				Object.entries(after).map(([key, count]) => [key, count - (before[key] ?? 0)])
			)
			if (operation.read) {
				if (!result || typeof result !== 'object' || Object.keys(result).length !== keyCount) {
					throw new Error(`${operation.name} did not retrieve all ${keyCount} keys`)
				}
			} else if ((await server.client.send('DBSIZE', [])) !== 0) {
				throw new Error(`${operation.name} did not delete all ${keyCount} keys`)
			}
			if (sample >= 0) durations.push(elapsed)
		}
		durations.sort((a, b) => a - b)
		const middle = Math.floor(durations.length / 2)
		const median = durations.length % 2 === 0 ? (durations[middle - 1] + durations[middle]) / 2 : durations[middle]
		results.push({ operation: operation.name, medianMs: Number(median.toFixed(3)), commands })
	}
	process.stdout.write(`${JSON.stringify({ bun: Bun.version, keyCount, samples, results }, null, 2)}\n`)
} finally {
	cache.redisClient.close()
	await server.stop()
}
