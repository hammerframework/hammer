import fs from 'fs'

import merge from 'deepmerge'
import toml from 'toml'

import { getConfigPath } from './paths'

export enum TargetEnum {
  NODE = 'node',
  BROWSER = 'browser',
  REACT_NATIVE = 'react-native',
  ELECTRON = 'electron',
}

export interface NodeTargetConfig {
  name?: string
  host: string
  port: number
  path: string
  target: TargetEnum.NODE
  schemaPath: string
}

interface BrowserTargetConfig {
  name?: string
  host: string
  port: number
  path: string
  target: TargetEnum.BROWSER
  /**
   * Specify the URL to your api-server.
   * This can be an absolute path proxied on the current domain (`/.netlify/functions`),
   * or a fully qualified URL (`https://api.example.org:8911/functions`).
   *
   * Note: This shoulld not include the path to the GraphQL Server,
   * `apiURL` and `apiGraphQLServerPath` are combined to determine the exact
   * URL.
   **/
  apiURL: string
  /**
   * The URL relative to the `apiURL` that specifies the location to Redwood
   * GraphQL Server.
   **/
  apiGraphQLServerPath: string
  /**  @deprecated - use `apiHost` and `apiGraphQLServerPath` instead. */
  apiProxyPort?: number
  /**  @deprecated - use `apiHost` and `apiGraphQLServerPath` instead. */
  apiProxyPath?: string
  fastRefresh: boolean
  a11y: boolean
}

export interface Config {
  web: BrowserTargetConfig
  api: NodeTargetConfig
  browser: {
    open: boolean | string
  }
  generate: {
    tests: boolean
    stories: boolean
    nestScaffoldByModel: boolean
  }
  experimental: {
    esbuild: boolean
    useEnvelop: boolean
  }
}

// Note that web's includeEnvironmentVariables is handled in `webpack.common.js`
// https://github.com/redwoodjs/redwood/blob/d51ade08118c17459cebcdb496197ea52485364a/packages/core/config/webpack.common.js#L19
const DEFAULT_CONFIG: Config = {
  web: {
    host: 'localhost',
    port: 8910,
    path: './web',
    target: TargetEnum.BROWSER,
    apiURL: '/.netlify/functions',
    apiGraphQLServerPath: '/graphql',
    fastRefresh: true,
    a11y: true,
  },
  api: {
    host: 'localhost',
    port: 8911,
    path: './api',
    target: TargetEnum.NODE,
    schemaPath: './api/db/schema.prisma',
  },
  browser: {
    open: false,
  },
  generate: {
    tests: true,
    stories: true,
    nestScaffoldByModel: true,
  },
  experimental: {
    esbuild: false,
    useEnvelop: false,
  },
}

/**
 * These configuration options are modified by the user via the Redwood
 * config file.
 */
export const getConfig = (configPath = getConfigPath()): Config => {
  try {
    const rawConfig = fs.readFileSync(configPath, 'utf8')
    return merge(DEFAULT_CONFIG, toml.parse(rawConfig))
  } catch (e) {
    throw new Error(`Could not parse "${configPath}": ${e}`)
  }
}
