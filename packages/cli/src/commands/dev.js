import fs from 'fs'

import concurrently from 'concurrently'
import terminalLink from 'terminal-link'

import { getConfig, shutdownPort } from '@redwoodjs/internal'

import { getPaths } from 'src/lib'
import c from 'src/lib/colors'
import { generatePrismaClient } from 'src/lib/generatePrismaClient'

export const command = 'dev [side..]'
export const description = 'Start development servers for api, and web'
export const builder = (yargs) => {
  yargs
    .positional('side', {
      choices: ['api', 'web'],
      default: ['api', 'web'],
      description: 'Which dev server(s) to start',
      type: 'array',
    })
    .positional('forward', {
      alias: 'fwd',
      description:
        'String of one or more Webpack DevServer config options, for example: `--fwd="--port=1234 --open=false"`',
      type: 'string',
    })
    .option('esbuild', {
      type: 'boolean',
      required: false,
      default: getConfig().experimental.esbuild,
      description: 'Use ESBuild [experimental]',
    })
    .option('useEnvelop', {
      type: 'boolean',
      required: false,
      default: getConfig().experimental.useEnvelop,
      description:
        'Use Envelop as GraphQL Server instead of Apollo Server [experimental]',
    })
    .option('generate', {
      type: 'boolean',
      default: true,
      description: 'Generate artifacts',
    })
    .epilogue(
      `Also see the ${terminalLink(
        'Redwood CLI Reference',
        'https://redwoodjs.com/reference/command-line-interface#dev'
      )}`
    )
}

export const handler = async ({
  side = ['api', 'web'],
  forward = '',
  esbuild = false,
  useEnvelop = false,
  generate = true,
}) => {
  const rwjsPaths = getPaths()

  if (side.includes('api')) {
    try {
      await generatePrismaClient({
        verbose: false,
        force: false,
        schema: getPaths().api.dbSchema,
      })
    } catch (e) {
      console.error(c.error(e.message))
    }

    try {
      await shutdownPort(getConfig().api.port)
    } catch (e) {
      console.error(
        `Error whilst shutting down "api" port: ${c.error(e.message)}`
      )
    }
  }

  if (side.includes('web')) {
    try {
      await shutdownPort(getConfig().web.port)
    } catch (e) {
      console.error(
        `Error whilst shutting down "web" port: ${c.error(e.message)}`
      )
    }
  }

  const webpackDevConfig = require.resolve(
    '@redwoodjs/core/config/webpack.development.js'
  )

  /** @type {Record<string, import('concurrently').CommandObj>} */
  const jobs = {
    api: {
      name: 'api',
      command: `cd "${rwjsPaths.api.base}" && yarn cross-env NODE_ENV=development yarn dev-server`,
      prefixColor: 'cyan',
      runWhen: () => fs.existsSync(rwjsPaths.api.src),
    },
    web: {
      name: 'web',
      command: `cd "${rwjsPaths.web.base}" && yarn cross-env NODE_ENV=development webpack serve --config "${webpackDevConfig}" ${forward}`,
      prefixColor: 'blue',
      runWhen: () => fs.existsSync(rwjsPaths.web.src),
    },
    gen: {
      name: 'gen',
      command: 'yarn rw-gen-watch',
      prefixColor: 'green',
      runWhen: () => generate,
    },
  }

  if (esbuild) {
    jobs.api.name = 'api esbuild'
    jobs.api.command =
      'yarn cross-env NODE_ENV=development NODE_OPTIONS=--enable-source-maps yarn rw-api-server-watch'

    jobs.web.name = 'web esbuild'
    jobs.web.command = 'yarn cross-env ESBUILD=1 && ' + jobs.web.command
  }

  if (useEnvelop) {
    jobs.api.name = jobs.api.name + ' with envelop'
  }

  // TODO: Convert jobs to an array and supply cwd command.
  concurrently(
    Object.keys(jobs)
      .map((job) => {
        if (side.includes(job) || job === 'gen') {
          return jobs[job]
        }
      })
      .filter((job) => job && job.runWhen()),
    {
      prefix: '{name} |',
      timestampFormat: 'HH:mm:ss',
    }
  ).catch((e) => {
    if (typeof e?.message !== 'undefined') {
      console.error(c.error(e.message))
      process.exit(1)
    }
  })
}
