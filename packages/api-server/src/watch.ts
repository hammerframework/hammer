#!/usr/bin/env node

import { fork } from 'child_process'
import type { ChildProcess } from 'child_process'
import path from 'path'

import c from 'ansi-colors'
import chokidar from 'chokidar'
import dotenv from 'dotenv'
import { debounce } from 'lodash'

import { getPaths, buildApi } from '@redwoodjs/internal'

const rwjsPaths = getPaths()

dotenv.config({
  path: rwjsPaths.base,
})

// TODO:
// 1. Move this file out of the HTTP server, and place it in the CLI?

let httpServerProcess: ChildProcess

const rebuildApiServer = () => {
  try {
    const buildTs = Date.now()
    process.stdout.write(c.dim(c.italic('Building... ')))
    buildApi()
    console.log(c.dim(c.italic('Took ' + (Date.now() - buildTs) + ' ms')))

    // Restart the API server
    httpServerProcess?.emit('exit')
    httpServerProcess?.kill()
    httpServerProcess = fork(path.join(__dirname, 'index.js'))
  } catch (e) {
    console.error(e)
  }
}

// We want to delay exection when multiple files are modified on the filesystem,
// this usually happens when running RedwoodJS generator commands.
const delayRestartServer = debounce(rebuildApiServer, 500)

chokidar
  .watch(rwjsPaths.api.base, {
    persistent: true,
    ignoreInitial: true,
    ignored: (file: string) =>
      file.includes('node_modules') ||
      file.includes(rwjsPaths.api.dist) ||
      file.includes(rwjsPaths.api.types) ||
      file.includes(rwjsPaths.api.db) ||
      [
        '.db',
        '.sqlite',
        '-journal',
        '.test.js',
        '.test.ts',
        '.scenarios.ts',
        '.scenarios.js',
        '.d.ts',
      ].some((ext) => file.endsWith(ext)),
  })
  .on('ready', async () => {
    rebuildApiServer()
  })
  .on('all', (eventName, filePath) => {
    console.log(
      c.dim(`[${eventName}] ${filePath.replace(rwjsPaths.api.base, '')}`)
    )
    delayRestartServer.cancel()
    delayRestartServer()
  })
