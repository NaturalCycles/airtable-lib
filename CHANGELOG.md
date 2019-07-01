## [2.0.2](https://github.com/NaturalCycles/airtable-lib/compare/v2.0.1...v2.0.2) (2019-07-01)


### Bug Fixes

* don't update lastChanged when cache was undefined ([9a679f3](https://github.com/NaturalCycles/airtable-lib/commit/9a679f3))

## [2.0.1](https://github.com/NaturalCycles/airtable-lib/compare/v2.0.0...v2.0.1) (2019-07-01)


### Bug Fixes

* don't consider base changed when lazy-loaded ([1da0cea](https://github.com/NaturalCycles/airtable-lib/commit/1da0cea))

# [2.0.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.27.1...v2.0.0) (2019-07-01)


### Features

* allow to rxjs-subscribe to base changes ([33546ab](https://github.com/NaturalCycles/airtable-lib/commit/33546ab))


### BREAKING CHANGES

* lastUpdatedMap > lastFetchedMap, lastChanged

## [1.27.1](https://github.com/NaturalCycles/airtable-lib/compare/v1.27.0...v1.27.1) (2019-05-31)


### Bug Fixes

* handle fetch of undefined base ([6514b64](https://github.com/NaturalCycles/airtable-lib/commit/6514b64))

# [1.27.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.26.2...v1.27.0) (2019-05-31)


### Features

* refactor tableCfgMap ([a128038](https://github.com/NaturalCycles/airtable-lib/commit/a128038))

## [1.26.2](https://github.com/NaturalCycles/airtable-lib/compare/v1.26.1...v1.26.2) (2019-05-30)


### Bug Fixes

* setCache(undefined) case ([426fd92](https://github.com/NaturalCycles/airtable-lib/commit/426fd92))

## [1.26.1](https://github.com/NaturalCycles/airtable-lib/compare/v1.26.0...v1.26.1) (2019-05-30)


### Bug Fixes

* records order due to magic 'view' property ([cd61c0c](https://github.com/NaturalCycles/airtable-lib/commit/cd61c0c))

# [1.26.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.25.0...v1.26.0) (2019-05-30)


### Features

* default lazyConnector to JSON ([e412158](https://github.com/NaturalCycles/airtable-lib/commit/e412158))

# [1.25.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.24.0...v1.25.0) (2019-05-30)


### Features

* lazy load from lazyConnector, fetchSync ([7c29872](https://github.com/NaturalCycles/airtable-lib/commit/7c29872))

# [1.24.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.23.0...v1.24.0) (2019-05-29)


### Features

* basesDao.getDao() ([93d46dd](https://github.com/NaturalCycles/airtable-lib/commit/93d46dd))

# [1.23.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.22.0...v1.23.0) (2019-05-28)


### Features

* AirtableTableSchemaMap ([febdba3](https://github.com/NaturalCycles/airtable-lib/commit/febdba3))

# [1.22.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.21.0...v1.22.0) (2019-05-28)


### Features

* improve connector interface ([3d7f73c](https://github.com/NaturalCycles/airtable-lib/commit/3d7f73c))

# [1.21.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.20.0...v1.21.0) (2019-05-28)


### Features

* more renames ([e3dc9bc](https://github.com/NaturalCycles/airtable-lib/commit/e3dc9bc))

# [1.20.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.19.0...v1.20.0) (2019-05-28)


### Features

* renames ([0a4e2ef](https://github.com/NaturalCycles/airtable-lib/commit/0a4e2ef))

# [1.19.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.18.0...v1.19.0) (2019-05-28)


### Features

* refactor to use Connector interface ([7c1acd3](https://github.com/NaturalCycles/airtable-lib/commit/7c1acd3))

# [1.18.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.17.0...v1.18.0) (2019-05-27)


### Features

* AirtableBaseDao allows extension ([05701f0](https://github.com/NaturalCycles/airtable-lib/commit/05701f0))

# [1.17.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.16.0...v1.17.0) (2019-05-27)


### Features

* basesDao.getLastUpdatedMap() ([434c672](https://github.com/NaturalCycles/airtable-lib/commit/434c672))

# [1.16.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.15.0...v1.16.0) (2019-05-27)


### Features

* BasesDao.getCacheMap() ([e782801](https://github.com/NaturalCycles/airtable-lib/commit/e782801))

# [1.15.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.14.0...v1.15.0) (2019-05-26)


### Features

* refactor to AirtableBaseDao ([5a840f7](https://github.com/NaturalCycles/airtable-lib/commit/5a840f7))

# [1.14.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.13.1...v1.14.0) (2019-05-26)


### Features

* cache.get > getById, requireById ([e1b2b5c](https://github.com/NaturalCycles/airtable-lib/commit/e1b2b5c))

## [1.13.1](https://github.com/NaturalCycles/airtable-lib/compare/v1.13.0...v1.13.1) (2019-05-25)


### Bug Fixes

* export airtableApi differently ([96f43d0](https://github.com/NaturalCycles/airtable-lib/commit/96f43d0))

# [1.13.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.12.0...v1.13.0) (2019-05-25)


### Features

* rename clashing types ([d0c3320](https://github.com/NaturalCycles/airtable-lib/commit/d0c3320))

# [1.12.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.11.0...v1.12.0) (2019-05-25)


### Features

* export AirtableBase, sortAirtableBase and more ([98fe141](https://github.com/NaturalCycles/airtable-lib/commit/98fe141))

# [1.11.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.10.0...v1.11.0) (2019-05-24)


### Features

* types ([d4e19b8](https://github.com/NaturalCycles/airtable-lib/commit/d4e19b8))

# [1.10.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.9.0...v1.10.0) (2019-05-24)


### Features

* AirtableCache.getByIds(), renames ([0a672d7](https://github.com/NaturalCycles/airtable-lib/commit/0a672d7))
* improve typings (not sure) ([a144a6a](https://github.com/NaturalCycles/airtable-lib/commit/a144a6a))

# [1.9.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.8.0...v1.9.0) (2019-05-24)


### Features

* airtableLib.fetchRemoteBases() ([20be07c](https://github.com/NaturalCycles/airtable-lib/commit/20be07c))

# [1.8.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.7.0...v1.8.0) (2019-05-22)


### Features

* treatment of multi-select and attachments ([cefe57d](https://github.com/NaturalCycles/airtable-lib/commit/cefe57d))

# [1.7.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.6.0...v1.7.0) (2019-05-22)


### Features

* typed AirtableBaseSchema ([bb5772c](https://github.com/NaturalCycles/airtable-lib/commit/bb5772c))

# [1.6.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.5.0...v1.6.0) (2019-05-22)


### Features

* AirtableAttachment type and schema ([24c2153](https://github.com/NaturalCycles/airtable-lib/commit/24c2153))

# [1.5.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.4.0...v1.5.0) (2019-05-22)


### Features

* airtableMultipleLinkSchema is a typed function now ([92e26d5](https://github.com/NaturalCycles/airtable-lib/commit/92e26d5))

# [1.4.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.3.0...v1.4.0) (2019-05-22)


### Features

* airtableSingleLinkSchema, airtableMultipleLinkSchema default to [] ([87fcce6](https://github.com/NaturalCycles/airtable-lib/commit/87fcce6))

# [1.3.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.2.0...v1.3.0) (2019-05-22)


### Features

* update deps ([03cd5d2](https://github.com/NaturalCycles/airtable-lib/commit/03cd5d2))

# [1.2.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.1.0...v1.2.0) (2019-05-19)


### Features

* deps ([7725595](https://github.com/NaturalCycles/airtable-lib/commit/7725595))

# [1.1.0](https://github.com/NaturalCycles/airtable-lib/compare/v1.0.0...v1.1.0) (2019-05-17)


### Features

* progress ([e015f20](https://github.com/NaturalCycles/airtable-lib/commit/e015f20))

# 1.0.0 (2019-05-10)


### Features

* first version (service and dao) ([0e72720](https://github.com/NaturalCycles/airtable-lib/commit/0e72720))
* init project by create-module ([74e3ec9](https://github.com/NaturalCycles/airtable-lib/commit/74e3ec9))
