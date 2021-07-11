import fs from 'fs'
import https from 'https'
import path from 'path'

import * as babel from '@babel/core'
import { getDMMF } from '@prisma/sdk'
import camelcase from 'camelcase'
import decamelize from 'decamelize'
import execa from 'execa'
import Listr from 'listr'
import VerboseRenderer from 'listr-verbose-renderer'
import lodash from 'lodash/string'
import { paramCase } from 'param-case'
import pascalcase from 'pascalcase'
import pluralize from 'pluralize'
import { format } from 'prettier'

import {
  getPaths as getRedwoodPaths,
  getConfig as getRedwoodConfig,
} from '@redwoodjs/internal'

import c from './colors'

/**
 * Used to memoize results from `getSchema` so we don't have to go through
 * the work of open the file and parsing it from scratch each time getSchema()
 * is called with the same model name.
 */
const schemaMemo = {}

export const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

/**
 * Returns the database schema for the given `name` database table parsed from
 * the schema.prisma of the target application. If no `name` is given then the
 * entire schema is returned.
 */
export const getSchema = async (name) => {
  if (name) {
    if (!schemaMemo[name]) {
      const schema = await getSchemaDefinitions()
      const model = schema.datamodel.models.find((model) => {
        return model.name === name
      })

      if (model) {
        // look for any fields that are enums and attach the possible enum values
        // so we can put them in generated test files
        model.fields.forEach((field) => {
          const fieldEnum = schema.datamodel.enums.find((e) => {
            return field.type === e.name
          })
          if (fieldEnum) {
            field.enumValues = fieldEnum.values
          }
        })

        // memoize based on the model name
        schemaMemo[name] = model
      } else {
        throw new Error(
          `No schema definition found for \`${name}\` in schema.prisma file`
        )
      }
    }
    return schemaMemo[name]
  } else {
    return (await getSchemaDefinitions()).metadata.datamodel
  }
}

/**
 * Returns the enum defined with the given `name` parsed from
 * the schema.prisma of the target applicaiton. If no `name` is given then the
 * all enum definitions are returned
 */
export const getEnum = async (name) => {
  const schema = await getSchemaDefinitions()

  if (name) {
    const model = schema.datamodel.enums.find((model) => {
      return model.name === name
    })

    if (model) {
      return model
    } else {
      throw new Error(
        `No enum schema definition found for \`${name}\` in schema.prisma file`
      )
    }
  }

  return schema.metadata.datamodel.enums
}

/*
 * Returns the DMMF defined by `prisma` resolving the relevant `schema.prisma` path.
 */
export const getSchemaDefinitions = async () => {
  const schemaPath = path.join(getPaths().api.db, 'schema.prisma')
  const metadata = await getDMMF({
    datamodel: readFile(schemaPath.toString()),
  })

  return metadata
}

/**
 * Returns variants of the passed `name` for usage in templates. If the given
 * name was "fooBar" then these would be:

 * pascalName: FooBar
 * singularPascalName: FooBar
 * pluralPascalName: FooBars
 * singularCamelName: fooBar
 * pluralCamelName: fooBars
 * singularParamName: foo-bar
 * pluralParamName: foo-bars
 * singularConstantName: FOO_BAR
 * pluralConstantName: FOO_BARS
*/
export const nameVariants = (name) => {
  const normalizedName = pascalcase(paramCase(pluralize.singular(name)))

  return {
    pascalName: pascalcase(name),
    camelName: camelcase(name),
    singularPascalName: normalizedName,
    pluralPascalName: pluralize(normalizedName),
    singularCamelName: camelcase(normalizedName),
    pluralCamelName: camelcase(pluralize(normalizedName)),
    singularParamName: paramCase(normalizedName),
    pluralParamName: paramCase(pluralize(normalizedName)),
    singularConstantName: decamelize(normalizedName).toUpperCase(),
    pluralConstantName: decamelize(pluralize(normalizedName)).toUpperCase(),
  }
}

export const templateRoot = path.resolve(__dirname, '../commands/generate')

export const generateTemplate = (templateFilename, { name, root, ...rest }) => {
  const templatePath = path.join(root || templateRoot, templateFilename)
  const template = lodash.template(readFile(templatePath).toString())

  const renderedTemplate = template({
    name,
    ...nameVariants(name),
    ...rest,
  })

  return prettify(templateFilename, renderedTemplate)
}

export const prettify = (templateFilename, renderedTemplate) => {
  // We format .js and .css templates, we need to tell prettier which parser
  // we're using.
  // https://prettier.io/docs/en/options.html#parser
  const parser = {
    '.css': 'css',
    '.js': 'babel',
    '.ts': 'babel-ts',
  }[path.extname(templateFilename.replace('.template', ''))]

  if (typeof parser === 'undefined') {
    return renderedTemplate
  }

  return format(renderedTemplate, {
    ...prettierOptions(),
    parser,
  })
}

export const readFile = (target) => fs.readFileSync(target)

const SUPPORTED_EXTENSIONS = ['.js', '.ts', '.tsx']

export const deleteFile = (file) => {
  const extension = path.extname(file)
  if (SUPPORTED_EXTENSIONS.includes(extension)) {
    const baseFile = getBaseFile(file)
    SUPPORTED_EXTENSIONS.forEach((ext) => {
      const f = baseFile + ext
      if (fs.existsSync(f)) {
        fs.unlinkSync(f)
      }
    })
  } else {
    fs.unlinkSync(file)
  }
}

const getBaseFile = (file) => file.replace(/\.\w*$/, '')

const existsAnyExtensionSync = (file) => {
  const extension = path.extname(file)
  if (SUPPORTED_EXTENSIONS.includes(extension)) {
    const baseFile = getBaseFile(file)
    return SUPPORTED_EXTENSIONS.some((ext) => fs.existsSync(baseFile + ext))
  }

  return fs.existsSync(file)
}

export const writeFile = (
  target,
  contents,
  { overwriteExisting = false } = {},
  task = {}
) => {
  const { base } = getPaths()
  task.title = `Writing \`./${path.relative(base, target)}\``
  if (!overwriteExisting && fs.existsSync(target)) {
    throw new Error(`${target} already exists.`)
  }

  const filename = path.basename(target)
  const targetDir = target.replace(filename, '')
  fs.mkdirSync(targetDir, { recursive: true })
  fs.writeFileSync(target, contents)
  task.title = `Successfully wrote file \`./${path.relative(base, target)}\``
}

export const saveRemoteFileToDisk = (
  url,
  localPath,
  { overwriteExisting = false } = {}
) => {
  if (!overwriteExisting && fs.existsSync(localPath)) {
    throw new Error(`${localPath} already exists.`)
  }

  const downloadPromise = new Promise((resolve, reject) =>
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(fs.createWriteStream(localPath))
        resolve()
      } else {
        reject(
          new Error(`${url} responded with status code ${response.statusCode}`)
        )
      }
    })
  )

  return downloadPromise
}

export const getInstalledRedwoodVersion = () => {
  try {
    const packageJson = require('../../package.json')
    return packageJson.version
  } catch (e) {
    console.error(c.error('Could not find installed redwood version'))
    process.exit(1)
  }
}

export const bytes = (contents) => Buffer.byteLength(contents, 'utf8')

/**
 * This wraps the core version of getPaths into something that catches the exception
 * and displays a helpful error message.
 */
export const getPaths = () => {
  try {
    return getRedwoodPaths()
  } catch (e) {
    console.error(c.error(e.message))
    process.exit(1)
  }
}

export const getConfig = () => {
  try {
    return getRedwoodConfig()
  } catch (e) {
    console.error(c.error(e.message))
    process.exit(1)
  }
}

/**
 * This returns the config present in `prettier.config.js` of a Redwood project.
 */
export const prettierOptions = () => {
  try {
    return require(path.join(getPaths().base, 'prettier.config.js'))
  } catch (e) {
    return undefined
  }
}

// TODO: Move this into `generateTemplate` when all templates have TS support
/*
 * Convert a generated TS template file into JS.
 */
export const transformTSToJS = (filename, content) => {
  const { code } = babel.transform(content, {
    filename,
    // If you ran `yarn rw generate` in `./web` transformSync would import the `.babelrc.js` file,
    // in `./web`? despite us setting `configFile: false`.
    cwd: process.env.NODE_ENV === 'test' ? undefined : getPaths().base,
    configFile: false,
    plugins: [
      [
        '@babel/plugin-transform-typescript',
        {
          isTSX: true,
          allExtensions: true,
        },
      ],
    ],
    retainLines: true,
  })

  return prettify(filename.replace(/\.ts$/, '.js'), code)
}

/**
 * Creates a list of tasks that write files to the disk.
 *
 * @param files - {[filepath]: contents}
 */
export const writeFilesTask = (files, options) => {
  const { base } = getPaths()
  return new Listr(
    Object.keys(files).map((file) => {
      const contents = files[file]
      return {
        title: `...waiting to write file \`./${path.relative(base, file)}\`...`,
        task: (ctx, task) => writeFile(file, contents, options, task),
      }
    })
  )
}

/**
 * Creates a list of tasks that delete files from the disk.
 *
 * @param files - {[filepath]: contents}
 */
export const deleteFilesTask = (files) => {
  const { base } = getPaths()

  return new Listr([
    ...Object.keys(files).map((file) => {
      return {
        title: `Destroying \`./${path.relative(base, getBaseFile(file))}\`...`,
        skip: () => !existsAnyExtensionSync(file) && `File doesn't exist`,
        task: () => deleteFile(file),
      }
    }),
    {
      title: 'Cleaning up empty directories...',
      task: () => cleanupEmptyDirsTask(files),
    },
  ])
}

/**
 * @param files - {[filepath]: contents}
 * Deletes any empty directrories that are more than three levels deep below the base directory
 * i.e. any directory below /web/src/components
 */
export const cleanupEmptyDirsTask = (files) => {
  const { base } = getPaths()
  const endDirs = Object.keys(files).map((file) => path.dirname(file))
  const uniqueEndDirs = [...new Set(endDirs)]
  // get the additional path directories not at the end of the path
  const pathDirs = []
  uniqueEndDirs.forEach((dir) => {
    const relDir = path.relative(base, dir)
    const splitDir = relDir.split(path.sep)
    splitDir.pop()
    while (splitDir.length > 3) {
      const subDir = path.join(base, splitDir.join('/'))
      pathDirs.push(subDir)
      splitDir.pop()
    }
  })
  const uniqueDirs = uniqueEndDirs.concat([...new Set(pathDirs)])

  return new Listr(
    uniqueDirs.map((dir) => {
      return {
        title: `Removing empty \`./${path.relative(base, dir)}\`...`,
        task: () => fs.rmdirSync(dir),
        skip: () => {
          if (!fs.existsSync(dir)) {
            return `Doesn't exist`
          }
          if (fs.readdirSync(dir).length > 0) {
            return 'Not empty'
          }
          return false
        },
      }
    })
  )
}

const wrapWithSet = (routesContent, layout, routes, newLineAndIndent) => {
  const [_, indentOne, indentTwo] = routesContent.match(
    /([ \t]*)<Router>[^<]*[\r\n]+([ \t]+)/
  ) || ['', 0, 2]
  const oneLevelIndent = indentTwo.slice(0, indentTwo.length - indentOne.length)
  const newRoutesWithExtraIndent = routes.map((route) => oneLevelIndent + route)
  return [`<Set wrap={${layout}}>`, ...newRoutesWithExtraIndent, `</Set>`].join(
    newLineAndIndent
  )
}

/**
 * Update the project's routes file.
 */
export const addRoutesToRouterTask = (routes, layout) => {
  const redwoodPaths = getPaths()
  const routesContent = readFile(redwoodPaths.web.routes).toString()
  const newRoutes = routes.filter((route) => !routesContent.match(route))

  if (newRoutes.length) {
    const [routerStart, newLineAndIndent] = routesContent.match(/<Router>(\s*)/)
    const routesBatch = layout
      ? wrapWithSet(routesContent, layout, newRoutes, newLineAndIndent)
      : newRoutes.join(newLineAndIndent)
    const newRoutesContent = routesContent.replace(
      routerStart,
      `${routerStart + routesBatch + newLineAndIndent}`
    )
    writeFile(redwoodPaths.web.routes, newRoutesContent, {
      overwriteExisting: true,
    })
  }
}

export const addScaffoldImport = () => {
  const appJsPath = getPaths().web.app
  let appJsContents = readFile(appJsPath).toString()

  if (appJsContents.match('./scaffold.css')) {
    return 'Skipping scaffold style include'
  }

  appJsContents = appJsContents.replace(
    "import Routes from 'src/Routes'\n",
    "import Routes from 'src/Routes'\n\nimport './scaffold.css'"
  )
  writeFile(appJsPath, appJsContents, { overwriteExisting: true })

  return 'Added scaffold import to App.{js,tsx}'
}

const removeEmtpySet = (routesContent, layout) => {
  const setWithLayoutReg = new RegExp(
    `\\s*<Set[^>]*wrap={${layout}}[^<]*>([^<]*)<\/Set>`
  )
  const [matchedSet, childContent] = routesContent.match(setWithLayoutReg) || []
  if (!matchedSet) {
    return routesContent
  }

  const child = childContent.replace(/\s/g, '')
  if (child.length > 0) {
    return routesContent
  }
  return routesContent.replace(setWithLayoutReg, '')
}

/**
 * Remove named routes from the project's routes file.
 *
 * @param {string[]} routes - Route names
 */
export const removeRoutesFromRouterTask = (routes, layout) => {
  const redwoodPaths = getPaths()
  const routesContent = readFile(redwoodPaths.web.routes).toString()
  const newRoutesContent = routes.reduce((content, route) => {
    const matchRouteByName = new RegExp(`\\s*<Route[^>]*name="${route}"[^>]*/>`)
    return content.replace(matchRouteByName, '')
  }, routesContent)

  const routesWithoutEmptySet = layout
    ? removeEmtpySet(newRoutesContent, layout)
    : newRoutesContent

  writeFile(redwoodPaths.web.routes, routesWithoutEmptySet, {
    overwriteExisting: true,
  })
}

export const runCommandTask = async (commands, { verbose }) => {
  const tasks = new Listr(
    commands.map(({ title, cmd, args, opts = {} }) => ({
      title,
      task: async () => {
        return execa(cmd, args, {
          shell: true,
          cwd: `${getPaths().base}/api`,
          stdio: verbose ? 'inherit' : 'pipe',
          extendEnv: true,
          cleanup: true,
          ...opts,
        })
      },
    })),
    {
      renderer: verbose && VerboseRenderer,
      dateFormat: false,
    }
  )

  try {
    await tasks.run()
    return true
  } catch (e) {
    console.log(c.error(e.message))
    return false
  }
}

/*
 * Extract default CLI args from an exported builder
 */
export const getDefaultArgs = (builder) => {
  return Object.entries(builder).reduce(
    (options, [optionName, optionConfig]) => {
      // If a default is defined use it
      options[optionName] = optionConfig.default
      return options
    },
    {}
  )
}
