## @naturalcycles/airtable-lib

> High-level API and CLI for Airtable.

[![npm](https://img.shields.io/npm/v/@naturalcycles/airtable-lib/latest.svg)](https://www.npmjs.com/package/@naturalcycles/airtable-lib)
[![](https://circleci.com/gh/NaturalCycles/airtable-lib.svg?style=shield&circle-token=123)](https://circleci.com/gh/NaturalCycles/airtable-lib)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

# Features

- Allows high level API access to Airtable contents
- Allows to download Airtable data to json (backup), upload it back with all links and order
  preserved (not trivial if using stock low-level api)

# API

- `AirtableLib`: high-level access object
  - `fetchBase` ...
- `AirtableDao`: access object for Airtable Table
- `AirtableCache`: indexed contents of Airtable Base (indexed by airtableId)

# Packaging

- `engines.node >= 10.13`: Latest Node.js LTS
- `main: dist/index.js`: commonjs, es2018
- `types: dist/index.d.ts`: typescript types
- `/src` folder with source `*.ts` files included

# todo

- [ ] joi to fill default values (e.g empty array, boolean-false, etc)
- [ ] CLI: airtable2json, json2airtable (baseSchema with joiValidation though?)
