import fs from 'fs'
import path from 'path'

import { transform, TransformOptions } from '@babel/core'
import { buildSync } from 'esbuild'
import rimraf from 'rimraf'

import { findApiFiles } from 'src/files'
import { getPaths } from 'src/paths'

export const buildApi = () => {
  // TODO: Be smarter about caching and invalidating cached files,
  // but right now we just delete everything.
  cleanApiBuild()

  const srcFiles = findApiFiles()
  const prebuiltFiles = prebuildApiFiles(srcFiles).filter(
    (x) => typeof x !== 'undefined'
  ) as string[]

  return transpileApi(prebuiltFiles)
}

export const cleanApiBuild = () => {
  const rwjsPaths = getPaths()
  rimraf.sync(rwjsPaths.api.dist)
  rimraf.sync(path.join(rwjsPaths.generated.prebuild, 'api'))
}

/**
 * Remove RedwoodJS "magic" from a user's code leaving JavaScript behind.
 */
export const prebuildApiFiles = (srcFiles: string[]) => {
  const rwjsPaths = getPaths()
  const plugins = getBabelPlugins()

  return srcFiles.map((srcPath) => {
    const result = prebuildFile(srcPath, plugins)
    if (!result?.code) {
      // TODO: Figure out a better way to return these programatically.
      console.warn('Error:', srcPath, 'could not prebuilt.')
      return undefined
    }

    let dstPath = srcPath.replace(rwjsPaths.base, '')
    dstPath = path.join(rwjsPaths.generated.prebuild, dstPath)
    dstPath = dstPath.replace(/\.(ts)$/, '.js') // TODO: Figure out a better way to handle extensions
    fs.mkdirSync(path.dirname(dstPath), { recursive: true })
    fs.writeFileSync(dstPath, result.code)
    return dstPath
  })
}

// TODO: This can be shared between the api and web sides, but web
// needs to determine plugins on a per-file basis.
export const prebuildFile = (
  srcPath: string,
  plugins: TransformOptions['plugins']
) => {
  const code = fs.readFileSync(srcPath, 'utf-8')
  const result = transform(code, {
    cwd: getPaths().base,
    filename: srcPath,
    configFile: false,
    plugins,
  })
  return result
}

export const getBabelPlugins = () => {
  const rwjsPaths = getPaths()
  const plugins = [
    ['@babel/plugin-transform-typescript'],
    [
      require('@redwoodjs/core/dist/babelPlugins/babel-plugin-redwood-src-alias'),
      {
        srcAbsPath: rwjsPaths.api.src,
      },
    ],
    [
      require('@redwoodjs/core/dist/babelPlugins/babel-plugin-redwood-directory-named-import'),
    ],
    [
      'babel-plugin-auto-import',
      {
        declarations: [
          {
            // import gql from 'graphql-tag'
            default: 'gql',
            path: 'graphql-tag',
          },
          {
            // import { context } from '@redwoodjs/api'
            members: ['context'],
            path: '@redwoodjs/api',
          },
        ],
      },
    ],
    // FIXME: Babel plugin GraphQL tag doesn't seem to be working.
    ['babel-plugin-graphql-tag'],
    [
      require('@redwoodjs/core/dist/babelPlugins/babel-plugin-redwood-import-dir'),
    ],
  ].filter(Boolean)
  return plugins as Array<any>
}

export const transpileApi = (files: string[], options = {}) => {
  const rwjsPaths = getPaths()

  return buildSync({
    absWorkingDir: rwjsPaths.api.base,
    entryPoints: files,
    platform: 'node',
    target: process.env.NODE_ENV === 'development' ? 'esnext' : 'node12.21', // AWS Lambdas support NodeJS 12.x and 14.x, but what does Netlify Target?
    format: 'cjs',
    bundle: false,
    outdir: rwjsPaths.api.dist,
    sourcemap: 'external', // figure out what's best during development.
    ...options,
  })
}
