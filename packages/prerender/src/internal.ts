import fs from 'fs'
import path from 'path'

import fetch from 'node-fetch'

import type { AuthContextInterface } from '@redwoodjs/auth'
import { getConfig, getPaths } from '@redwoodjs/internal'

const INDEX_FILE = path.join(getPaths().web.dist, 'index.html')
const DEFAULT_INDEX = path.join(getPaths().web.dist, 'defaultIndex.html')

export const getRootHtmlPath = () => {
  if (fs.existsSync(DEFAULT_INDEX)) {
    return DEFAULT_INDEX
  } else {
    return INDEX_FILE
  }
}

export const registerShims = () => {
  global.__REDWOOD__API_PROXY_PATH = getConfig().web.apiProxyPath

  global.__REDWOOD__USE_AUTH = () =>
    ({
      loading: true, // this should play nicely if the app waits for auth stuff to comeback first before render
      isAuthenticated: false,
    } as AuthContextInterface) // we only need a parital AuthContextInterface for prerender

  global.__REDWOOD__PRERENDERING = true

  global.__REDWOOD__HELMET_CONTEXT = {}

  // Let routes auto loader plugin know
  process.env.__REDWOOD__PRERENDERING = '1'

  // Shim fetch in the node.js context
  // This is to avoid using cross-fetch when configuring apollo-client
  // which would cause the client bundle size to increase
  if (!global.fetch) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore-next-line
    global.fetch = fetch
  }
}

export const writeToDist = (outputHtmlPath: string, renderOutput: string) => {
  const dirName = path.dirname(outputHtmlPath)
  const exist = fs.existsSync(dirName)
  if (!exist) {
    fs.mkdirSync(dirName, { recursive: true })
  }

  fs.writeFileSync(outputHtmlPath, renderOutput)
}
