#!/usr/bin/env node
/* eslint-env node, commonjs */

const { build } = require('./apiBuild')

// Hello. Test this like so:
// You're in the root of the RedwoodJS framework directory:
// RWJS_CWD=__fixtures__/example-todo-main node packages/core/esbuild/index.js

console.time('Building API...')
build().then(() => console.timeEnd('Building API...'))
