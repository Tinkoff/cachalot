# Cachalot

[![Build status](https://img.shields.io/travis/TinkoffCreditSystems/cachalot/master.svg?style=flat-square)](https://travis-ci.org/TinkoffCreditSystems/cachalot)
[![Coveralls github](https://img.shields.io/coveralls/github/TinkoffCreditSystems/cachalot.svg?style=flat-square)](https://coveralls.io/github/TinkoffCreditSystems/cachalot)
[![Written in typescript](https://img.shields.io/badge/written_in-typescript-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![npm](https://img.shields.io/npm/v/cachalot.svg?style=flat-square)](https://www.npmjs.com/package/cachalot)

The library is designed to cache query results. Features:
* Implements popular caching strategies (Read-Through, Write-Through, Refresh-Ahead), and also allows them to be combined
* Defines an adapter interface that allows you to use it with any key-value storage for which the corresponding adapter is written
* Comes with adapter for redis
* Allows to use prefixes for keys, automatic hashing
* Allows to pass in a logger that will be used to display informational messages and errors
* Supports various behaviors of cache write waiting (heavy queries), more details below.

### Getting started

To initialize Cache instance, you need:
* StorageAdapter (in the example below, an adapter for connecting to redis). RedisStorageAdapter takes as an argument the instance of ioredis client.
* Settings object. The options are the following options:
  
   - prefix - prefix used by CacheManager for storing keys. In essence, this is the namespace for a specific CacheManager.
  
   - logger - instance of logger. Must implement following interface:

    ```typescript
    interface Logger {
      info(...args: any[]): void;
      trace(...args: any[]): void;
      warn(...args: any[]): void;
      error(...args: any[]): void;
    }
    ```
   - expiresIn - the time after which the keys lose relevance (ms)

##### Example of use:

Initialization:

```typescript
// cache.ts

import Redis from 'ioredis';
import Cache, { RedisStorageAdapter } from 'cachalot';
import logger from './logger';

const redis = new Redis();

export const cache = new Cache({
  adapter: new RedisStorageAdapter(redis),
  logger,
});
```
If your Redis instance uses eviction policy you need to use separate Redis instance for tags. **Tags should not be evicted!**

```typescript
// cache-with-tags.ts

import Redis from 'ioredis';
import Cache, { RedisStorageAdapter } from 'cachalot';
import logger from './logger';

const redis = new Redis(); // with eviction policy enabled
const redisForTags = new Redis(6380);

export const cache = new Cache({
  adapter: new RedisStorageAdapter(redis),
  tagsAdapter: new RedisStorageAdapter(redisForTags),
  logger,
});
```

There are three main methods of working with Cache; their behavior depends on the chosen caching strategy:

`get` gets cache data

```typescript
// get-something.ts
import { cache } from './cache'

const cacheKey = 'something:id100'; // key that records and accesses the value

function getSomething() {
  return cache.get(
      cacheKey,
      () => executor('hello', 'world'), // executor is a function that returns promise. Run if failed to get valid cache entry
      { tags: [cacheKey, 'something'] }, // you can associate tags with any cache record. You can later invalidate record with any of them.
    );
}
```

`get` will check the tags and compare their versions with the current date, runs an executor if necessary and returns result.
Options for `get`:
- expiresIn?: number; - The number of milliseconds after which key values are considered expired
- tags?: string[] | (() => string[]) - Tags - keys for which checks the validity of a particular record. If the tag value in the cache + invalidation time is <the current time, then the tag will be considered invalid and the record will need to be obtained using the executor. Can be calculated lazy.
- getTags?: (executorResult) => string[] function which extracts tags from executor result. These tags will be merged with tags given in option below.

The next method, "touch", serves to invalidate tags. Calling this method with one of the tags will make all records in the cache with this tag invalid.
It can be used both to invalidate a single record (for example, by creating a unique id) or a group of records.

Example:
```typescript
import { cache } from './cache'

async function createSomething() {
  await cache.touch(['something']) // invalidates all entries with the tag "something"
}
```
The latter method is `set`, used in write-through strategies to update entries.

Note that `touch` does not make sense when using Write-Through in its pure form, just as there is no point in using set in the Refresh-Ahead and Read-Through strategies

## Locked key retrieve strategies

Cachalot allows you to set a strategy for `get` behavior if the cache entry is locked (for updating). Available strategies:

`waitForResult` -` get` will wait for the result to appear in the cache and the lock will be removed. Good to use with heavy demands and average load
. Under high loads, spikes can occur due to queuing requests.

`runExecutor` -` get` will immediately call the executor and return its result. Good in cases where requests are light. The disadvantage of
this strategy is a temporary increase in the load on the database at the time of updating the record. This strategy is used by default.

For each entry, the strategy can be set individually. To do this, its name must be passed in the readThrough options.
```typescript
cache.get('something:id100', () => executor('hello', 'world'), {
    tags: [cacheKey, 'something'],
    lockedKeyRetrieveStrategy: 'runExecutor'
  },
);
```
### Cache Managers

For all the examples above, the Refresh-Ahead strategy is used. This strategy is used by default, but it is possible to connect other strategies from cachalot.
Different caching strategies implement different classes of "managers". Each manager has a string identifier.
When registering a strategy, it is obtained by calling the getName static method of the manager class. Further, the same identifier can be used
in get and set calls to tell the Cache instance to which manager to delegate the call.

#### Refresh-Ahead

The Refresh-Ahead Cache strategy allows the developer to configure the cache to automatically and asynchronously reload (refresh) any recently available cache entry from the cache loader before it expires. As a result, after a frequently used entry entered the cache, the application will not sense the effect of reading on the potentially slow cache storage when the entry is reloaded due to expiration. An asynchronous update is launched only when accessing an object close enough to its expiration time — if the object is accessed after it has expired, Cache will perform a synchronous read from the cache storage to update its value.

The refresh ahead factor is expressed as a percentage of the record expiration time. For example, suppose that the expiration time for entries in the cache is set to 60 seconds, and refresh ahead factor is set to 0.5. If the cached object is accessed after 60 seconds, Cache will perform a synchronous read from the cache storage to update its value. However, if the request is made for a record that is older than 30, but less than 60 seconds, the current value in the cache is returned, and Cache plans an asynchronous reboot from the cache storage.

An advanced update is especially useful if objects are accessed by a large number of users. The values ​​in the cache remain fresh, and the delay that may result from an excessive reload from the cache storage is eliminated.

By default, RefreshAhead is already defined in Cache with default settings. However, you can override it. To do this, simply register `RefreshAheadManager` again

```typescript
cache.registerManager(RefreshAheadManager, null, {
  refreshAheadFactor: 0.5,
});
```
#### Read-Through

When an application requests an entry in the cache, for example, the X key, and X is not yet in the cache, Cache will automatically call executor, which loads X from the underlying data source. If X exists in the data source, executor loads it, returns it to Cache, then Cache puts it in the cache for future use and finally returns X to the application code that requested it. This is called read-through caching. Advanced caching functionality (Refresh-Ahead) can further improve read performance (by reducing the estimated latency).

```typescript
import Redis from 'ioredis';
import logger from './logger';
import Cache, { RedisStorageAdapter, ReadThroughManager } from 'cachalot'; // constructor adapter for redis

const redis = new Redis();

export const cache = new Cache({
  adapter: new RedisStorageAdapter(redis),
  logger,
});

cache.registerManager(ReadThroughManager);

// ...
const x = await cache.get('something:id100', () => executor('hello', 'world'), {
    tags: [cacheKey, 'something'],
    manager: 'read-through',
  },
);
```
#### Write-Through

With Write-Through, get causes no validation logic for the cache, tags, and so on. A record is considered invalid only if it is not in the cache as such. In this strategy, when an application updates a portion of the data in the cache (that is, calls set (...) to change the cache entry), the operation will not complete (that is, set will not return) until the Cache has passed through the underlying database and successfully saved data to the underlying data source. This does not improve write performance at all, since you are still dealing with a delay in writing to the data source.

#### Read-Through + Write-Through

It is also possible to combine different strategies, the most common option is Read-Through + Write-Through.

```typescript
// ...
export const cache = new Cache({
  adapter: new RedisStorageAdapter(redisClient),
  logger,
});

cache.registerManager(ReadThroughManager);
cache.registerManager(WriteThroughManager);

// creates permanent record
cache.set('something:id100', 'hello', {
  tags: ['something:id100', 'something'],
  manager: WriteThroughManager.getName()
});

// gets the record
const x = await cache.get('something:id100', () => executor('hello', 'world'), {
    tags: ['something:id100', 'something'],
    manager: ReadThroughManager.getName(),
  },
);
```
## License

```
Copyright 2019 Tinkoff Bank

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
