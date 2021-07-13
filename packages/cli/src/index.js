#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

import { config } from 'dotenv-defaults'
import yargs from 'yargs'

import {
  getPaths,
  getConfigPath,
  telemetryMiddleware,
} from '@redwoodjs/internal'

/**
 * The current working directory can be set via:
 * 1. A `--cwd` option
 * 2. The `RWJS_CWD` env-var
 * 3. Found by traversing directories upwards for the first `redwood.toml`
 *
 * This middleware parses, validates, and sets current working directory
 * in the order above.
 */
const getCwdMiddleware = (argv) => {
  let configPath

  try {
    let cwd
    if (argv.cwd) {
      cwd = argv.cwd
      // We delete the argument because it's not actually referenced in CLI,
      // we use the `RWJS_CWD` env-var,
      // and it conflicts with "forwarding" commands such as test and prisma.
      delete argv.cwd
    } else if (process.env.RWJS_CWD) {
      cwd = process.env.RWJS_CWD
    } else {
      cwd = path.dirname(getConfigPath())
    }

    configPath = path.resolve(process.cwd(), cwd, 'redwood.toml')
    if (!fs.existsSync(configPath)) {
      throw new Error('Could not find `redwood.toml` config file.')
    }

    process.env.RWJS_CWD = cwd
  } catch (e) {
    console.error()
    console.error('Error: Redwood CLI could not find your config file.')
    console.error(`Expected '${configPath}'`)
    console.error()
    console.error(`Did you run Redwood CLI in a RedwoodJS project?`)
    console.error(`Or specify an incorrect '--cwd' option?`)
    console.error()
    process.exit(1)
  }
}

const loadDotEnvDefaultsMiddleware = () => {
  config({
    path: path.join(getPaths().base, '.env'),
    defaults: path.join(getPaths().base, '.env.defaults'),
    encoding: 'utf8',
  })
}

// eslint-disable-next-line no-unused-expressions
yargs
  .scriptName('rw')
  .middleware([
    getCwdMiddleware,
    loadDotEnvDefaultsMiddleware,
    telemetryMiddleware,
  ])
  .option('cwd', {
    describe: 'Working directory to use (where `redwood.toml` is located.)',
  })
  .commandDir('./commands')
  .example(
    'yarn rw g page home /',
    "\"Create a page component named 'Home' at path '/'\""
  )
  .demandCommand()
  .strict().argv
