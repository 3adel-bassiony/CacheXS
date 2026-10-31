# CacheXS

![npm](https://img.shields.io/npm/v/cachexs)
![npm bundle size](https://img.shields.io/bundlephobia/min/cachexs)
![npm package minimized gzipped size (select exports)](https://img.shields.io/bundlejs/size/cachexs)
![gh-workflow-image](https://img.shields.io/github/actions/workflow/status/3adel-bassiony/cachexs/main.yml)
![NPM](https://img.shields.io/npm/l/cachexs)

Discover CacheXS, a lightweight Redis caching library designed for performance and simplicity in JavaScript and TypeScript applications running on Bun. Written in TypeScript and powered by [Bun's native `RedisClient`](https://bun.com/docs/runtime/redis), it provides a straightforward API for caching data, controlling expiration, and managing namespaced keys. Its compact package has no runtime dependencies and includes atomic conditional writes, expiring counters, and efficient batch operations. With ESM support, CacheXS works with modern Bun projects, from small utilities to larger services.

CacheXS requires Bun 1.4.4 or newer and a Redis server.

&nbsp;

## Quick Navigation

1. [Installation](#installation)
2. [Usage](#usage)
3. [Documentation](#documentation)
4. [Support and Questions](#installation)
5. [Contribution](#contribution)
6. [Guidelines for Contributions](#guidelines-for-contributions)
7. [License](#license)

&nbsp;

# Installation

Getting up and running with CacheXS is a breeze. Choose your preferred package manager from the options below and follow the simple installation steps:

```bash
bun i cachexs
```

&nbsp;

# Usage

Once you have installed CacheXS, integrating it into your project is straightforward. Below are the basic steps to get you started:

First, import CacheXS into your JavaScript or TypeScript file:

```typescript
import CacheXS from 'cachexs'
```

Then create a new instance for CacheXS and pass the configuration to it:

```typescript
const cacheXS = new CacheXS({
	redisOptions: {
		// Connection timeout in milliseconds (default: 10000)
		connectionTimeout: 5000,

		// Idle timeout in milliseconds (default: 0 = no timeout)
		idleTimeout: 30000,

		// Whether to automatically reconnect on disconnection (default: true)
		autoReconnect: true,

		// Maximum number of reconnection attempts (default: 10)
		maxRetries: 10,

		// Whether to queue commands when disconnected (default: true)
		enableOfflineQueue: true,

		// Whether to automatically pipeline commands (default: true)
		enableAutoPipelining: true,

		// TLS options (default: false)
		tls: true,
		// Alternatively, provide custom TLS config:
		// tls: {
		//   rejectUnauthorized: true,
		//   ca: "path/to/ca.pem",
		//   cert: "path/to/cert.pem",
		//   key: "path/to/key.pem",
		// }
	},
})
```

And then you can use it like this:

```typescript
const cachedData = await cacheXS.get('foo') // -> cached value, or null if missing
```

&nbsp;

# Documentation

The CacheXS package comes with a comprehensive set of features designed to make cache in your application straightforward and efficient. This section provides an overview of its capabilities and guides on how to use them effectively.

-   ### Features Overview

    -   **Simple Cache Management**: Easily cache the data in Redis with simple functions.
    -   **Expiration Control**: Set, update, and check expiration times for cached entries.
    -   **Pattern Matching**: Find, retrieve, and delete cache entries using powerful pattern matching with `scan` and `keys` methods.
    -   **Conditional Caching**: Use `setIfNotExists`, `getOrSet`, and `getOrSetForever` for intelligent cache operations.
    -   **Bulk Operations**: Efficiently work with multiple cache entries at once with pattern-based operations.

-   ### Usage & Configuration

    -   #### **Installation**

        Refer to the [Installation](#installation) section for instructions on how to install CacheXS using various package managers.

    -   #### **Initializing the Library:**

        You can create a new instance of CacheXS and pass the configuration for it directly like this example below:

        ```typescript
        const cacheXS = new CacheXS({
        	redisClient: redis,
        	namespace: 'myCache',
        	enableDebug: true,
        })
        ```

        Alternatively, you can split the creation of the new instance and the configuration, useful when split up into different modules for bootstrapping.

        ```typescript
        const cacheXS = new CacheXS()

        cacheXS.configure({
        	redisClient: redis,
        	namespace: 'myCache',
        	enableDebug: true,
        })
        ```

        `configure` updates only the supplied settings. Changing the namespace, expiration, or debug setting keeps the current connection. Supplying a Redis URL or options creates a replacement connection and closes the previous connection if CacheXS created it. Injected clients remain owned by the caller.

        You can import the configuration type from the package root:

        ```typescript
        import CacheXS, { type CacheXSConfig } from 'cachexs'
        ```

        Values written through CacheXS preserve strings, including empty strings and JSON-like strings, as well as JSON objects, arrays, numbers, booleans, and null. `undefined` is stored as JSON null. Existing raw Redis strings and JSON values remain readable; numeric values remain compatible with Redis counters. Direct reads through `redisClient` return the serialized value.

        Expiring writes require a positive safe integer number of seconds. Use the `Forever` methods to store entries without expiration. `setIfNotExists` uses atomic `SET NX`; `getOrSet`, `getOrSetForever`, and `incrementWithExpiry` use Lua scripts for atomic updates. Redis ACLs must allow `EVAL` and the commands used by those methods (`GET`, `SET`, `INCR`, and `EXPIRE`).

-   ### Methods/Properties

    -   `get` Retrieves the value associated with the specified key from the cache.

        ```typescript
        const stringValue = await cacheXS.get<string>('myKey') // -> myValue
        const stringValue = await cacheXS.get<number>('myKey') // -> 123
        const objectValue = await cacheXS.get<MyObject>('myKey') // -> { name: 'John', age: 30 }
        ```

    -   `set`: Sets a value in the cache.

        ```typescript
        await cacheXS.set('myKey', 'myValue')
        await cacheXS.set('myKey', 123)
        await cacheXS.set('myKey', { name: 'John', age: 30 }, 360) // expires in 360 seconds
        ```

    -   `setForever` Sets a value in the cache forever

        ```typescript
        await cacheXS.setForever('user', { name: 'John Doe', age: 30 })
        ```

    -   `setIfNotExists` Atomically sets a value only if the key does not already exist. Returns `'OK'` when stored and `'EXIST'` when already present, without changing the existing value or expiration.

        ```typescript
        await cacheXS.setIfNotExists('myKey', 'myValue', 360) // expires in 360 seconds
        ```

    -   `getOrSet` Returns the cached value, including `false`, `0`, `''`, or `null`. If the key is missing, atomically stores the fallback and returns the value stored by the winning writer.

        ```typescript
        const username = await cacheXS.getOrSet('myKey', 'myValue', 360) // expires in 360 seconds
        ```

    -   `getOrSetForever` Uses the same conditional behavior as `getOrSet`, storing new entries without expiration. Existing entries keep their expiration.

        ```typescript
        value = await cacheXS.getOrSetForever('myKey', 'defaultValue')
        ```

    -   `increment` Increments the value of a key by one. If the key does not exist, it will be set to 0 before performing the operation. Returns the new value after incrementing.

        ```typescript
        const newValue = await cacheXS.increment('count') // -> 1 (if key doesn't exist)
        const nextValue = await cacheXS.increment('count') // -> 2
        ```

    -   `decrement` Decrements the value of a key by one. If the key does not exist, it will be set to 0 before performing the operation. Returns the new value after decrementing.

        ```typescript
        const newValue = await cacheXS.decrement('count') // -> -1 (if key doesn't exist)
        const nextValue = await cacheXS.decrement('count') // -> -2
        ```

    -   `incrementWithExpiry` Atomically increments a counter and sets its expiration when the resulting value is `1`. Later increments keep the original expiration.

        ```typescript
        const hits = await cacheXS.incrementWithExpiry('hits', 60)
        ```

    -   `expire` Sets the expiration time for a key.

        ```typescript
        await cacheXS.expire('myKey', 60) // expires in 60 seconds
        ```

    -   `expireNow` Expires a key immediately.

        ```typescript
        await cacheXS.expireNow('myKey')
        ```

    -   `ttl` Gets the time to live for a key in seconds.

        ```typescript
        const ttl = await cacheXS.ttl('myKey') // -> 60
        ```

    -   `delete` Deletes a cache entry by its key.

        ```typescript
        await cacheXS.delete('myKey')
        ```

    -   `deleteMany` Deletes multiple entries using batches of up to 500 keys per `DEL` command, with at most 32 pending commands so Bun can pipeline them.

        ```typescript
        await cacheXS.deleteMany(['myKey', 'myKey2', 'myKey3'])
        ```

    -   `clear` Uses `SCAN` and batched deletion to clear the configured namespace. With the default empty namespace, it clears all keys in the selected Redis database.

        ```typescript
        await cacheXS.clear()
        ```

    -   `exists` Checks if a key exists in the cache.

        ```typescript
        await cacheXS.exists('myKey') // -> true || false
        ```

    -   `missing` Checks if a key is missing in the cache.

        ```typescript
        await cacheXS.missing('myKey') // -> true || false
        ```

    -   `scan` Finds unique keys matching a Redis glob pattern using `SCAN`. Namespace characters are treated literally. Returned keys omit the namespace prefix. The count is a positive integer scan hint, not a limit on the total number of results.

        ```typescript
        const userKeys = await cacheXS.scan('user:*') // -> ['user:123', 'user:456']
        const sessionKeys = await cacheXS.scan('session:*', 50) // with custom count
        ```

    -   `keys` Finds keys matching a pattern using the KEYS command (blocking, use with caution in production).

        ```typescript
        const userKeys = await cacheXS.keys('user:*') // -> ['user:123', 'user:456']
        ```

    -   `getByPattern` Retrieves matching values using `SCAN` and `MGET` batches of up to 500 keys. Keys that disappear or have a non-string Redis type are returned with a null value, following `MGET` semantics.

        ```typescript
        const userData = await cacheXS.getByPattern<User>('user:*')
        // -> { 'user:123': {...}, 'user:456': {...} }

        // Use KEYS command instead of SCAN
        const configData = await cacheXS.getByPattern('config:*', false)
        ```

    -   `deleteByPattern` Deletes matching keys in batches and returns the number actually deleted. Keys that expired before deletion are excluded from the count.

        ```typescript
        const deletedCount = await cacheXS.deleteByPattern('session:*:expired')
        console.log(`Deleted ${deletedCount} expired sessions`)

        // Use KEYS command instead of SCAN
        const count = await cacheXS.deleteByPattern('temp:*', false)
        ```

    -   `concatenateKey` Concatenates the given key with the namespace and returns the resulting string.

        ```typescript
        await cacheXS.concatenateKey('myKey') // -> 'CacheXS:myKey'
        ```

    -   `redisClient` Gets the Redis connection.

        ```typescript
        cacheXS.redisClient // -> Bun redis instance
        ```

    -   `ping` Sends a Redis ping, optionally echoing a message.

        ```typescript
        await cacheXS.ping() // -> 'PONG'
        await cacheXS.ping('hello') // -> 'hello'
        ```

    -   `isConnected` Checks Redis with a ping and returns `false` if the connection fails.

        ```typescript
        const connected = await cacheXS.isConnected()
        ```

    -   `redisUrl` Gets the Redis URL.

        ```typescript
        cacheXS.redisUrl // -> 'redis://user:pass@localhost:6379'
        ```

    -   `redisOptions` Gets the Redis configuration.

        ```typescript
        cacheXS.redisOptions // -> { host: 'localhost', port: 6379, password: '' }
        ```

    -   `expiresIn` Gets the expiration time in seconds.

        ```typescript
        cacheXS.expiresIn // -> 60
        ```

    -   `namespace` Gets the namespace of the cache.

        ```typescript
        cacheXS.namespace // -> 'CacheXS
        ```

    -   `isDebugEnabled` Gets a value indicating whether debug mode is enabled.

        ```typescript
        cacheXS.isDebugEnabled // -> True || False
        ```

    ```

    ```

&nbsp;

# Support and Questions

If you have any questions or need support while using CacheXS, feel free to open an issue on our [GitHub repository](https://github.com/3adel-bassiony/CacheXS/issues) or reach out to the community for help.

For the complete and detailed guide, please refer to our [official documentation](#documentation).

&nbsp;

# Contribution

First off, thank you for considering contributing to CacheXS! It's people like you who make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

There are many ways you can contribute to CacheXS, even if you're not a technical person:

-   **Submit Bug Reports:** If you find a bug, please open an issue. Remember to include a clear description and as much relevant information as possible.
-   **Feature Suggestions:** Have an idea for a new feature or an improvement? Open an issue and tag it as a feature request.
-   **Code Contributions:** Interested in adding a feature or fixing a bug? Awesome! Please open a pull request with your changes.
-   **Documentation:** Good documentation is key to any project. If you see something unclear or missing, feel free to submit a pull request.
-   **Spread the Word:** Share CacheXS with your network and let others know about it.

&nbsp;

# Guidelines for Contributions

Ensure you use a consistent coding style with the rest of the project.
Write clear, readable, and concise code.
Add unit tests for new features to ensure reliability and maintainability.
Update the README or documentation with details of changes, this includes new environment variables, exposed ports, useful file locations, and container parameters.
Increase the version numbers in any example files and the README to the new version that this Pull Request would represent.

&nbsp;

## Development checks

Install Bun and the `redis-server` executable, then run:

```bash
bun install --frozen-lockfile
bun check
bun run lint
bun run build
bun test --coverage
bun run bench
```

`bun check` uses Bun's native TypeScript checker and discovers the library source, tests, and benchmarks through `tsconfig.json`. The build uses `tsconfig.build.json` to emit only library files.

The full suite is verified on Bun 1.4.4. Bun 1.3.2 crashes while running the Redis tests and is not supported.

Tests keep the existing `bun:test` describe/it structure in `src/tests/package.test.ts`. Tests and benchmarks start their own temporary Redis process on an available loopback port, disable persistence, and remove it afterward. They do not use your application's Redis server or `REDIS_URL`.

The benchmark reports median durations and Redis command counts after two warmup runs. It uses 10,000 keys and seven measured samples by default; customize these with `CACHEXS_BENCH_KEYS` and `CACHEXS_BENCH_SAMPLES`.

# License

CacheXS is licensed under the MIT License. This license permits use, modification, and distribution, free of charge, for both private and commercial purposes. It also offers a good balance between protecting the author's rights and allowing for flexibility and freedom in the use of the software.
