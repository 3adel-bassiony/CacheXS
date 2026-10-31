import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { RedisClient } from 'bun'

export async function startRedisServer() {
	if (!Bun.which('redis-server')) {
		throw new Error('Install redis-server to run CacheXS tests and benchmarks')
	}

	const listener = createServer()
	await new Promise<void>((resolve, reject) => {
		listener.once('error', reject)
		listener.listen(0, '127.0.0.1', resolve)
	})
	const address = listener.address()
	if (!address || typeof address === 'string') throw new Error('Expected a TCP address')
	await new Promise<void>((resolve) => listener.close(() => resolve()))

	const directory = await mkdtemp(join(tmpdir(), 'cachexs-test-'))
	const url = `redis://127.0.0.1:${address.port}`
	let server: ReturnType<typeof Bun.spawn> | undefined
	let client: RedisClient | undefined

	const stop = async () => {
		client?.close()
		if (server) {
			server.kill()
			await server.exited
		}
		await rm(directory, { recursive: true, force: true })
	}

	try {
		server = Bun.spawn(
			[
				'redis-server',
				'--bind',
				'127.0.0.1',
				'--port',
				String(address.port),
				'--dir',
				directory,
				'--save',
				'',
				'--appendonly',
				'no',
			],
			{ stdout: 'pipe', stderr: 'inherit' }
		)
		const reader = server.stdout.getReader()
		const decoder = new TextDecoder()
		let output = ''
		let timeout: ReturnType<typeof setTimeout> | undefined
		try {
			await Promise.race([
				(async () => {
					while (!output.includes('Ready to accept connections')) {
						const { value, done } = await reader.read()
						if (done) throw new Error(`Redis failed to start: ${output}`)
						output += decoder.decode(value, { stream: true })
					}
				})(),
				new Promise<never>((_, reject) => {
					timeout = setTimeout(() => reject(new Error(`Redis startup timed out: ${output}`)), 4000)
				}),
			])
		} finally {
			clearTimeout(timeout)
			reader.releaseLock()
		}
		client = new RedisClient(url)
		await client.connect()

		return { url, client, stop }
	} catch (error) {
		await stop()
		throw error
	}
}
