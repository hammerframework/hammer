import fs from 'fs'
import path from 'path'

import fg from 'fast-glob'
import findUp from 'findup-sync'

import { getConfig } from './config'

export interface NodeTargetPaths {
  base: string
  dataMigrations: string
  db: string
  dbSchema: string
  src: string
  functions: string
  graphql: string
  lib: string
  services: string
  config: string
  dist: string
  types: string
}

export interface BrowserTargetPaths {
  base: string
  src: string
  app: string
  index: string | null
  routes: string
  pages: string
  components: string
  layouts: string
  config: string
  webpack: string
  postcss: string
  storybookConfig: string
  storybookPreviewConfig: string
  dist: string
  types: string
}

export interface Paths {
  base: string
  generated: {
    base: string
    schema: string
    types: {
      includes: string
      mirror: string
    }
    prebuild: string
  }
  web: BrowserTargetPaths
  api: NodeTargetPaths
  scripts: string
}

export interface PagesDependency {
  /** the variable to which the import is assigned */
  importName: string
  /** @alias importName */
  const: string
  /** absolute path without extension */
  importPath: string
  /** absolute path with extension */
  path: string
  /** const ${importName} = { ...data structure for async imports... } */
  importStatement: string
}

const CONFIG_FILE_NAME = 'redwood.toml'

// TODO: Remove these.
const PATH_API_DIR_FUNCTIONS = 'api/src/functions'
const PATH_RW_SCRIPTS = 'scripts'
const PATH_API_DIR_GRAPHQL = 'api/src/graphql'
const PATH_API_DIR_CONFIG = 'api/src/config'
const PATH_API_DIR_LIB = 'api/src/lib'
const PATH_API_DIR_SERVICES = 'api/src/services'
const PATH_API_DIR_SRC = 'api/src'
const PATH_WEB_ROUTES = 'web/src/Routes' // .js|.tsx
const PATH_WEB_DIR_LAYOUTS = 'web/src/layouts/'
const PATH_WEB_DIR_PAGES = 'web/src/pages/'
const PATH_WEB_DIR_COMPONENTS = 'web/src/components'
const PATH_WEB_DIR_SRC = 'web/src'
const PATH_WEB_DIR_SRC_APP = 'web/src/App'
const PATH_WEB_DIR_SRC_INDEX = 'web/src/index' // .js|.tsx
const PATH_WEB_DIR_CONFIG = 'web/config'
const PATH_WEB_DIR_CONFIG_WEBPACK = 'web/config/webpack.config.js'
const PATH_WEB_DIR_CONFIG_POSTCSS = 'web/config/postcss.config.js'
const PATH_WEB_DIR_CONFIG_STORYBOOK_CONFIG = 'web/config/storybook.config.js'
const PATH_WEB_DIR_CONFIG_STORYBOOK_PREVIEW = 'web/config/storybook.preview.js'

const PATH_WEB_DIR_DIST = 'web/dist'

/**
 * Search the parent directories for the Redwood configuration file.
 */
export const getConfigPath = (
  cwd: string = process.env.RWJS_CWD ?? process.cwd()
): string => {
  const configPath = findUp(CONFIG_FILE_NAME, { cwd })
  if (!configPath) {
    throw new Error(
      `Could not find a "${CONFIG_FILE_NAME}" file, are you sure you're in a Redwood project?`
    )
  }
  return configPath
}

/**
 * The Redwood config file is used as an anchor for the base directory of a project.
 */
export const getBaseDir = (configPath: string = getConfigPath()): string => {
  return path.dirname(configPath)
}

export const getBaseDirFromFile = (file: string) => {
  return getBaseDir(getConfigPath(path.dirname(file)))
}

/**
 * Use this to resolve files when the path to the file is known,
 * but the extension is not.
 */
export const resolveFile = (
  filePath: string,
  extensions: string[] = ['.js', '.tsx', '.ts', '.jsx']
): string | null => {
  for (const extension of extensions) {
    const p = `${filePath}${extension}`
    if (fs.existsSync(p)) {
      return p
    }
  }
  return null
}

/**
 * Path constants that are relevant to a Redwood project.
 */
// TODO: Make this a proxy and make it lazy.
export const getPaths = (BASE_DIR: string = getBaseDir()): Paths => {
  const routes = resolveFile(path.join(BASE_DIR, PATH_WEB_ROUTES)) as string
  const { schemaPath } = getConfig(getConfigPath(BASE_DIR)).api
  const schemaDir = path.dirname(schemaPath)

  const paths = {
    base: BASE_DIR,

    generated: {
      base: path.join(BASE_DIR, '.redwood'),
      schema: path.join(BASE_DIR, '.redwood/schema.graphql'),
      types: {
        includes: path.join(BASE_DIR, '.redwood/types/includes'),
        mirror: path.join(BASE_DIR, '.redwood/types/mirror'),
      },
      prebuild: path.join(BASE_DIR, '.redwood/prebuild'),
    },

    scripts: path.join(BASE_DIR, PATH_RW_SCRIPTS),

    api: {
      base: path.join(BASE_DIR, 'api'),
      dataMigrations: path.join(BASE_DIR, schemaDir, 'dataMigrations'),
      db: path.join(BASE_DIR, schemaDir),
      dbSchema: path.join(BASE_DIR, schemaPath),
      functions: path.join(BASE_DIR, PATH_API_DIR_FUNCTIONS),
      graphql: path.join(BASE_DIR, PATH_API_DIR_GRAPHQL),
      lib: path.join(BASE_DIR, PATH_API_DIR_LIB),
      config: path.join(BASE_DIR, PATH_API_DIR_CONFIG),
      services: path.join(BASE_DIR, PATH_API_DIR_SERVICES),
      src: path.join(BASE_DIR, PATH_API_DIR_SRC),
      dist: path.join(BASE_DIR, 'api/dist'),
      types: path.join(BASE_DIR, 'api/types'),
    },

    web: {
      routes,
      base: path.join(BASE_DIR, 'web'),
      pages: path.join(BASE_DIR, PATH_WEB_DIR_PAGES),
      components: path.join(BASE_DIR, PATH_WEB_DIR_COMPONENTS),
      layouts: path.join(BASE_DIR, PATH_WEB_DIR_LAYOUTS),
      src: path.join(BASE_DIR, PATH_WEB_DIR_SRC),
      app: resolveFile(path.join(BASE_DIR, PATH_WEB_DIR_SRC_APP)) as string,
      index: resolveFile(path.join(BASE_DIR, PATH_WEB_DIR_SRC_INDEX)),
      config: path.join(BASE_DIR, PATH_WEB_DIR_CONFIG),
      webpack: path.join(BASE_DIR, PATH_WEB_DIR_CONFIG_WEBPACK),
      postcss: path.join(BASE_DIR, PATH_WEB_DIR_CONFIG_POSTCSS),
      storybookConfig: path.join(
        BASE_DIR,
        PATH_WEB_DIR_CONFIG_STORYBOOK_CONFIG
      ),
      storybookPreviewConfig: path.join(
        BASE_DIR,
        PATH_WEB_DIR_CONFIG_STORYBOOK_PREVIEW
      ),
      dist: path.join(BASE_DIR, PATH_WEB_DIR_DIST),
      types: path.join(BASE_DIR, 'web/types'),
    },
  }

  fs.mkdirSync(paths.generated.types.includes, { recursive: true })
  fs.mkdirSync(paths.generated.types.mirror, { recursive: true })

  return paths
}

/**
 * Process the pages directory and return information useful for automated imports.
 *
 * Note: glob.sync returns posix style paths on Windows machines
 * @deprecated I will write a seperate method that use `getFiles` instead. This
 * is used by structure, babel auto-importer and the eslint plugin.
 */
export const processPagesDir = (
  webPagesDir: string = getPaths().web.pages
): Array<PagesDependency> => {
  const pagePaths = fg.sync('**/*Page.{js,jsx,ts,tsx}', {
    cwd: webPagesDir,
    ignore: ['node_modules'],
  })
  return pagePaths.map((pagePath) => {
    const p = path.parse(pagePath)

    const importName = p.dir.replace(/\//g, '')
    const importPath = importStatementPath(
      path.join(webPagesDir, p.dir, p.name)
    )

    const importStatement = `const ${importName} = { name: '${importName}', loader: import('${importPath}') }`
    return {
      importName,
      const: importName,
      importPath,
      path: path.join(webPagesDir, pagePath),
      importStatement,
    }
  })
}

/**
 * Converts Windows-style paths to Posix-style
 * C:\Users\Bob\dev\Redwood -> /c/Users/Bob/dev/Redwood
 *
 * The conversion only happens on Windows systems, and only for paths that are
 * not already Posix-style
 *
 * @param path Filesystem path
 */
export const ensurePosixPath = (path: string) => {
  let posixPath = path

  if (process.platform === 'win32') {
    if (/^[A-Z]:\\/.test(path)) {
      const drive = path[0].toLowerCase()
      posixPath = `/${drive}/${path.substring(3)}`
    }

    posixPath = posixPath.replace(/\\/g, '/')
  }

  return posixPath
}

/**
 * Switches backslash to regular slash on Windows so the path works in
 * import statements
 * C:\Users\Bob\dev\Redwood\UserPage\UserPage ->
 * C:/Users/Bob/dev/Redwood/UserPage/UserPage
 *
 * @param path Filesystem path
 */
export const importStatementPath = (path: string) => {
  let importPath = path

  if (process.platform === 'win32') {
    importPath = importPath.replaceAll('\\', '/')
  }

  return importPath
}
