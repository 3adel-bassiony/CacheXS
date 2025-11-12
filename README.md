# CacheXS

![npm](https://img.shields.io/npm/v/cachexs)
![npm bundle size](https://img.shields.io/bundlephobia/min/cachexs)
![npm package minimized gzipped size (select exports)](https://img.shields.io/bundlejs/size/cachexs)
![gh-workflow-image](https://img.shields.io/github/actions/workflow/status/3adel-bassiony/cachexs/main.yml)
![NPM](https://img.shields.io/npm/l/cachexs)

Discover CacheXS, a remarkably efficient library for JavaScript and Bun, ideal for developers prioritizing performance and simplicity. Written in TypeScript, and it uses bun redis under the hood, it offers seamless integration for both TypeScript and JavaScript projects. Its compact size belies its powerful functionality, making it perfect for lightweight, modern applications. With ESM compatibility, CacheXS aligns with contemporary development practices, ensuring its utility in a range of projects from small-scale to complex.

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
const cachedData = cacheXS.get('foo') // -> Bar
```

&nbsp;

# Documentation

The CacheXS package comes with a comprehensive set of features designed to make cache in your application straightforward and efficient. This section provides an overview of its capabilities and guides on how to use them effectively.

-   ### Features Overview

    -   **Simple Cache Management**: Easily cache the data in Redis with simple functions.

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
        await cacheXS.set('myKey', { name: 'John', age: 30 }, { expiresIn: 360 })
        ```

    -   `setForever` Sets a value in the cache forever

        ```typescript
        await cacheXS.setForever('user', { name: 'John Doe', age: 30 })
        ```

    -   `getOrSet` Retrieves the value associated with the specified key from the cache. If the value does not exist, it sets the value to the provided fallback value and returns it.

        ```typescript
        const username = await cacheXS.getOrSet('myKey', 'myValue')
        ```

    -   `getOrSetForever` Retrieves the value associated with the specified key from the cache. If the value does not exist, it sets the specified fallback value in the cache and returns it.

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

    -   `delete` Deletes a cache entry by its key.

        ```typescript
        await cacheXS.delete('myKey')
        ```

    -   `deleteMany` Deletes multiple cache entries specified by the given keys.

        ```typescript
        await cacheXS.deleteMany(['myKey', 'myKey2', 'myKey3'])
        ```

    -   `clear` Clears all cache entries in the CacheXS instance.

        ```typescript
        await cacheXS.clear()
        ```

    -   `has` Checks if a key exists in the cache.

        ```typescript
        await cacheXS.has('myKey') // -> True || False
        ```

    -   `missing` Checks if a key is missing in the cache.

        ```typescript
        await cacheXS.missing('myKey') // -> True || False
        ```

    -   `concatenateKey` Concatenates the given key with the namespace and returns the resulting string.

        ```typescript
        await cacheXS.concatenateKey('myKey') // -> 'CacheXS:myKey'
        ```

    -   `redisClient` Gets the Redis connection.

        ```typescript
        cacheXS.redisClient // -> Bun redis instance
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

# License

CacheXS is licensed under the MIT License. This license permits use, modification, and distribution, free of charge, for both private and commercial purposes. It also offers a good balance between protecting the author's rights and allowing for flexibility and freedom in the use of the software.
