import fs from 'fs'
import path from 'path'

import fg from 'fast-glob'

import { getNamedExports, hasDefaultExport } from './ast'
import { getPaths } from './paths'

export const findCells = (cwd: string = getPaths().web.src) => {
  const modules = fg.sync('**/*Cell.{js,jsx,ts,tsx}', {
    cwd,
    absolute: true,
    ignore: ['node_modules'],
  })
  return modules.filter(isCellFile)
}

export const findPages = (cwd: string = getPaths().web.pages) => {
  const modules = fg.sync('**/*Page.{tsx,js,jsx}', {
    cwd,
    absolute: true,
    ignore: ['node_modules'],
  })

  return modules.filter(isPageFile)
}

export const findDirectoryNamedModules = (cwd: string = getPaths().base) => {
  const modules = fg.sync('**/src/**/*.{ts,js,jsx,tsx}', {
    cwd,
    absolute: true,
    ignore: ['node_modules'],
  })

  // Cell's also follow use the directory-named-module pattern,
  // but they get their own special type mirror file, so ignore them.
  return modules
    .filter(isDirectoryNamedModuleFile)
    .filter((p) => !isCellFile(p))
}

export const findGraphQLSchemas = (cwd: string = getPaths().api.graphql) => {
  return fg
    .sync('**/*.sdl.{ts,js}', { cwd, absolute: true })
    .filter(isGraphQLSchemaFile)
}

const ignoreApiFiles = [
  '*.test.js',
  '*.test.ts',
  '*.scenarios.ts',
  '*.scenarios.js',
  '*.d.ts',
]

export const findApiFiles = (cwd: string = getPaths().api.src) => {
  const files = fg.sync('**/*.{js,ts}', {
    cwd,
    absolute: true,
    ignore: ignoreApiFiles,
  })
  return files
}

export const findApiServerFunctions = (
  cwd: string = getPaths().api.functions
) => {
  const files = fg.sync('**/*.{js,ts}', {
    cwd,
    absolute: true,
    deep: 2, // We don't support deeply nested api functions.
    ignore: ignoreApiFiles,
  })

  return files.filter((f) => isApiFunction(f, cwd))
}

export const isCellFile = (p: string) => {
  const { dir, name } = path.parse(p)
  // A Cell must be a directory named module.
  if (!dir.endsWith(name)) {
    return false
  }

  const code = fs.readFileSync(p, 'utf-8')

  // A Cell should not have a default export.
  if (hasDefaultExport(code)) {
    return false
  }

  // A Cell must export QUERY and Success.
  const exports = getNamedExports(code)
  const exportedQUERY = exports.findIndex((v) => v.name === 'QUERY') !== -1
  const exportedSuccess = exports.findIndex((v) => v.name === 'Success') !== -1
  if (!exportedQUERY && !exportedSuccess) {
    return false
  }

  return true
}

export const isPageFile = (p: string) => {
  const { dir, name } = path.parse(p)

  // A page must end with "Page.{jsx,js,tsx}".
  if (!name.endsWith('Page')) {
    return false
  }

  // A page should be in the `web/src/pages` directory.
  const r = path.relative(getPaths().web.pages, dir)
  if (!r && r.startsWith('..') && path.isAbsolute(r)) {
    return false
  }

  // A Page should have a default export.
  const code = fs.readFileSync(p, 'utf-8')
  if (!hasDefaultExport(code)) {
    return false
  }

  return true
}

export const isDirectoryNamedModuleFile = (p: string) => {
  const { dir, name } = path.parse(p)
  return dir.endsWith(name)
}

export const isGraphQLSchemaFile = (p: string) => {
  if (!p.match(/\.sdl\.(ts|js)$/)?.[0]) {
    return false
  }

  const code = fs.readFileSync(p, 'utf-8')
  const exports = getNamedExports(code)
  return exports.findIndex((v) => v.name === 'schema') !== -1
}

/**
 * The following patterns are supported for api functions:
 *
 * 1. a module at the top level: `/graphql.js`
 * 2. a module in a folder with a module of the same name: `/health/health.js`
 * 3. a module in a folder named index: `/x/index.js`
 */
export const isApiFunction = (p: string, functionsPath: string) => {
  p = p.replace(functionsPath + '/', '')
  const { dir, name } = path.parse(p)
  if (dir === name) {
    // Directory named module
    return true
  } else if (dir === '') {
    // Module in the functions root
    return true
  } else if (dir.length && name === 'index') {
    // Directory with an `index.js` file
    return true
  }
  return false
}
