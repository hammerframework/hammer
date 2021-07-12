// This file will only transpile the "magic parts" of RedwoodJS, leaving
// everything else unchanged, the motivation for doing so is making
// RedwoodJS easier to integrate with newer build tools.

import fs from 'fs'
import path from 'path'

import { transform } from '@babel/core'
import fg from 'fast-glob'

import { isCellFile } from './files'
import { getPaths } from './paths'

export const pretranspileWeb = () => {
  const rwjsPaths = getPaths()
  const files = fg.sync('src/**/*.{js,jsx,ts,tsx}', {
    cwd: rwjsPaths.web.base,
  })
  // hash files to understand if they've changed, and if we should re-transpile htem?
  for (const srcPath of files) {
    const result = pretranspileFile(path.join(rwjsPaths.web.base, srcPath))
    if (!result?.code) {
      // warn?
      return undefined
    }

    // Allow this to be configureable.
    const dstPath = path.join(
      rwjsPaths.generated.pretranspile,
      'web',
      srcPath.replace('.tsx', '.js').replace('.ts', '.js')
    )

    fs.mkdirSync(path.dirname(dstPath), { recursive: true })
    fs.writeFileSync(dstPath, result.code)
  }
}

export const getBabelPlugins = (srcPath: string) => {
  const rwjsPaths = getPaths()

  const plugins = [
    [
      require('@redwoodjs/core/dist/babelPlugins/babel-plugin-redwood-src-alias'),
      {
        srcAbsPath: rwjsPaths.web.src,
      },
    ],
    [
      require('@redwoodjs/core/dist/babelPlugins/babel-plugin-redwood-directory-named-import'),
    ],
    [
      '@babel/plugin-transform-typescript',
      {
        isTSX: true,
        allExtensions: true,
      },
    ],
    [
      'babel-plugin-auto-import',
      {
        declarations: [
          {
            // import { React } from 'react'
            default: 'React',
            path: 'react',
          },
          {
            // import PropTypes from 'prop-types'
            default: 'PropTypes',
            path: 'prop-types',
          },
          {
            // import gql from 'graphql-tag'
            default: 'gql',
            path: 'graphql-tag',
          },
          {
            // import { mockGraphQLQuery, mockGraphQLMutation, mockCurrentUser } from '@redwoodjs/testing'
            members: [
              'mockGraphQLQuery',
              'mockGraphQLMutation',
              'mockCurrentUser',
            ],
            path: '@redwoodjs/testing',
          },
        ],
      },
    ],
    [
      'babel-plugin-graphql-tag',
      {
        importSources: ['graphql-tag'],
        onlyMatchImportSuffix: true,
      },
    ],
    isCellFile(srcPath) && [
      require('@redwoodjs/core/dist/babelPlugins/babel-plugin-redwood-cell'),
    ],
    rwjsPaths.web.routes === srcPath && [
      require('@redwoodjs/core/dist/babelPlugins/babel-plugin-redwood-routes-auto-loader'),
      {
        useStaticImports: process.env.__REDWOOD__PRERENDERING === '1',
      },
    ],
  ].filter(Boolean)

  return plugins as Array<any>
}

export const pretranspileFile = (srcPath: string) => {
  const code = fs.readFileSync(srcPath, 'utf-8')
  const result = transform(code, {
    cwd: getPaths().base,
    filename: srcPath,
    configFile: false,
    plugins: getBabelPlugins(srcPath),
    retainLines: true,
  })
  return result
}
