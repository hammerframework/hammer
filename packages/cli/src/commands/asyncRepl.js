import path from 'path'
import repl from 'repl'

import babelRequireHook from '@babel/register'

import { getPaths } from 'src/lib'

const paths = getPaths().api

const mapDBToContext = (ctx) => {
  const { db } = require(path.join(paths.lib, 'db'))
  ctx.db = db
}

// Transpile on the fly
babelRequireHook({
  extends: path.join(paths.base, '.babelrc.js'),
  extensions: ['.js', '.ts'],
  only: [paths.base],
  ignore: ['node_modules'],
  cache: false,
})

const r = repl.start()

// Make the project's db (i.e. Prisma Client) available
mapDBToContext(r.context)
