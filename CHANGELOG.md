## [1.5.1](https://github.com/TinkoffCreditSystems/cachalot/compare/v1.5.0...v1.5.1) (2020-02-12)


### Bug Fixes

* Queue delete not touched tags command if adapter is not connected ([ce3c8f5](https://github.com/TinkoffCreditSystems/cachalot/commit/ce3c8f5))

# [1.5.0](https://github.com/TinkoffCreditSystems/cachalot/compare/v1.4.0...v1.5.0) (2020-02-04)


### Features

* Not touched tags optimization ([076e895](https://github.com/TinkoffCreditSystems/cachalot/commit/076e895))

# [1.4.0](https://github.com/TinkoffCreditSystems/cachalot/compare/v1.3.1...v1.4.0) (2020-01-29)


### Features

* Tags can be stored separately in case the main redis instance uses eviction policy. ([c25ae76](https://github.com/TinkoffCreditSystems/cachalot/commit/c25ae76))

## [1.3.1](https://github.com/TinkoffCreditSystems/cachalot/compare/v1.3.0...v1.3.1) (2020-01-28)


### Bug Fixes

* mset does not add cache key prefix. ([8d58233](https://github.com/TinkoffCreditSystems/cachalot/commit/8d58233))

# [1.3.0](https://github.com/TinkoffCreditSystems/cachalot/compare/v1.2.1...v1.3.0) (2020-01-27)


### Features

* Multiple get and set are now using for read/write tags. ([71d60a3](https://github.com/TinkoffCreditSystems/cachalot/commit/71d60a3))

## [1.2.1](https://github.com/TinkoffCreditSystems/cachalot/compare/v1.2.0...v1.2.1) (2020-01-23)


### Bug Fixes

* protect merged static and dynamic tags from being duplicated ([dabd053](https://github.com/TinkoffCreditSystems/cachalot/commit/dabd053))

# [1.2.0](https://github.com/TinkoffCreditSystems/cachalot/compare/v1.1.2...v1.2.0) (2020-01-23)


### Features

* Static tags can be lazy calculated ([6965862](https://github.com/TinkoffCreditSystems/cachalot/commit/6965862))

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
