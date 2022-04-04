## [3.3.1](https://github.com/Tinkoff/cachalot/compare/v3.3.0...v3.3.1) (2022-04-04)


### Bug Fixes

* lower log level in case when lock acquiring fails ([a03e77a](https://github.com/Tinkoff/cachalot/commit/a03e77a68f52a2f10325fc6ef96d74b127b0a64b))
* using correct binding when using 'waitForResult' strategy ([1aef8cc](https://github.com/Tinkoff/cachalot/commit/1aef8ccec89751dae6c6cc4be869d79e5151755a))

# [3.3.0](https://github.com/Tinkoff/cachalot/compare/v3.2.0...v3.3.0) (2021-12-29)


### Bug Fixes

* prettier ([acd94be](https://github.com/Tinkoff/cachalot/commit/acd94bee08fb7795ef01b83bef1c3104f3a5ec52))
* remove obsolete check for error ([141c242](https://github.com/Tinkoff/cachalot/commit/141c242c8dc1292122b9705ec16c4d8247bb8fcb))


### Features

* **deps:** updated dependencies, type lib versions, solved security alerts ([5512749](https://github.com/Tinkoff/cachalot/commit/5512749eb64a43ae9eb81015d5719e0e187bdb8e))

# [3.2.0](https://github.com/Tinkoff/cachalot/compare/v3.1.1...v3.2.0) (2021-06-10)


### Bug Fixes

* undefined into resolved ([e68a642](https://github.com/Tinkoff/cachalot/commit/e68a642af56a757ceaa713ef36e6e584d8028cac))


### Features

* update typescript version, added logo, updated core dev dependencies ([81480a5](https://github.com/Tinkoff/cachalot/commit/81480a5b2c6a4c97b3f1ce91500e32e01f2fcdd6))

## [3.1.1](https://github.com/Tinkoff/cachalot/compare/v3.1.0...v3.1.1) (2020-11-17)


### Bug Fixes

* redis: allow null return from set ([12a93dd](https://github.com/Tinkoff/cachalot/commit/12a93dd))

# [3.1.0](https://github.com/Tinkoff/cachalot/compare/v3.0.3...v3.1.0) (2020-08-01)


### Features

* make cachalot free from dependencies ([fc54e6c](https://github.com/Tinkoff/cachalot/commit/fc54e6c))

## [3.0.3](https://github.com/Tinkoff/cachalot/compare/v3.0.2...v3.0.3) (2020-06-24)


### Bug Fixes

* less lodash in project ([#31](https://github.com/Tinkoff/cachalot/issues/31)) ([5b4d99d](https://github.com/Tinkoff/cachalot/commit/5b4d99d))

## [3.0.2](https://github.com/Tinkoff/cachalot/compare/v3.0.1...v3.0.2) (2020-06-24)


### Bug Fixes

* Executor cannot return `undefined`. The only valid result for emptiness is `null`. ([ed8a701](https://github.com/Tinkoff/cachalot/commit/ed8a701))

## [3.0.1](https://github.com/Tinkoff/cachalot/compare/v3.0.0...v3.0.1) (2020-05-08)


### Bug Fixes

* Do not depend on redis or memcached typings ([95e1f2c](https://github.com/Tinkoff/cachalot/commit/95e1f2c))

# [3.0.0](https://github.com/Tinkoff/cachalot/compare/v2.0.0...v3.0.0) (2020-05-08)


### Performance Improvements

* Base storage only touches and get tags if tag list is not empty ([22b8d3a](https://github.com/Tinkoff/cachalot/commit/22b8d3a))


### BREAKING CHANGES

* fixed typings for get/set and managers. Throw errors if executor returns undefined. Executor should always return value or null - for emptiness

fix: Remove undefined as get return type.

Also removed `E extends Executor<R>` type parameter.

`Record.value` is always defined.

WriteOptions now has type parameter used in getTags signature.

Throw an error if executor returns undefined.

# [2.0.0](https://github.com/Tinkoff/cachalot/compare/v1.6.0...v2.0.0) (2020-03-17)


### Features

* **adapters:** Memcached adapter based on "memcached" module ([9b4aa04](https://github.com/Tinkoff/cachalot/commit/9b4aa04))


### BREAKING CHANGES

* **adapters:** * Removed tag reading optimizations. It is not intended to use caches in this way.
* The "del" interface has been changed to be more convenient.

# [1.6.0](https://github.com/Tinkoff/cachalot/compare/v1.5.1...v1.6.0) (2020-02-14)


### Features

* Queue "cached" commands if its execution timed out ([b024999](https://github.com/Tinkoff/cachalot/commit/b024999))

## [1.5.1](https://github.com/Tinkoff/cachalot/compare/v1.5.0...v1.5.1) (2020-02-12)


### Bug Fixes

* Queue delete not touched tags command if adapter is not connected ([ce3c8f5](https://github.com/Tinkoff/cachalot/commit/ce3c8f5))

# [1.5.0](https://github.com/Tinkoff/cachalot/compare/v1.4.0...v1.5.0) (2020-02-04)


### Features

* Not touched tags optimization ([076e895](https://github.com/Tinkoff/cachalot/commit/076e895))

# [1.4.0](https://github.com/Tinkoff/cachalot/compare/v1.3.1...v1.4.0) (2020-01-29)


### Features

* Tags can be stored separately in case the main redis instance uses eviction policy. ([c25ae76](https://github.com/Tinkoff/cachalot/commit/c25ae76))

## [1.3.1](https://github.com/Tinkoff/cachalot/compare/v1.3.0...v1.3.1) (2020-01-28)


### Bug Fixes

* mset does not add cache key prefix. ([8d58233](https://github.com/Tinkoff/cachalot/commit/8d58233))

# [1.3.0](https://github.com/Tinkoff/cachalot/compare/v1.2.1...v1.3.0) (2020-01-27)


### Features

* Multiple get and set are now using for read/write tags. ([71d60a3](https://github.com/Tinkoff/cachalot/commit/71d60a3))

## [1.2.1](https://github.com/Tinkoff/cachalot/compare/v1.2.0...v1.2.1) (2020-01-23)


### Bug Fixes

* protect merged static and dynamic tags from being duplicated ([dabd053](https://github.com/Tinkoff/cachalot/commit/dabd053))

# [1.2.0](https://github.com/Tinkoff/cachalot/compare/v1.1.2...v1.2.0) (2020-01-23)


### Features

* Static tags can be lazy calculated ([6965862](https://github.com/Tinkoff/cachalot/commit/6965862))

#### [1.1.2]
- Fixed potential vulnerability by updating lodash

#### [1.1.1]
- run executor after storage throws an error
- change default operation timeout to 150

#### [1.1.0]
- support for dynamic tags in Manager's default storage via "getTags" option.
- updated jest
- security updates

#### [1.0.1]
- update package.json information
- version bump
