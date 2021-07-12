#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

import Configstore from 'configstore/index'
import execa from 'execa'
import TerminalLink from 'terminal-link'

import { getConfigPath } from '@redwoodjs/internal'

const config = new Configstore('@redwoodjs/cli')

const RWFW_PATH =
  process.env.RWFW_PATH || process.env.RW_PATH || config.get('RWFW_PATH')

if (!RWFW_PATH) {
  console.error('Error: You must specify the path to Redwood Framework')
  console.error('Usage: `RWFW_PATH=~/gh/redwoodjs/redwood yarn rwfw <command>')
  process.exit(1)
}

if (!fs.existsSync(RWFW_PATH)) {
  console.error(
    `Error: The specified path to Redwood Framework (${RWFW_PATH}) does not exist.`
  )
  console.error('Usage: `RWFW_PATH=~/gh/redwoodjs/redwood yarn rwfw <command>')
  process.exit(1)
}

const absRwFwPath = path.resolve(process.cwd(), RWFW_PATH)
config.set('RWFW_PATH', absRwFwPath)

// Execute the commands in the Redwood Framework Tools package.
const projectPath = path.dirname(
  getConfigPath(process.env.RWJS_CWD ?? process.cwd())
)
const fwToolsPath = path.join(absRwFwPath, 'tasks/framework-tools')
console.log(
  'Redwood Framework Tools Path:',
  TerminalLink(fwToolsPath, fwToolsPath)
)

let command = process.argv.slice(2)
if (!command.length) {
  command = ['run']
}

try {
  execa.sync('yarn', ['--cwd', fwToolsPath, ...command], {
    stdio: 'inherit',
    shell: true,
    env: {
      RWJS_CWD: projectPath,
    },
  })
} catch (e) {
  console.log()
  //
}
