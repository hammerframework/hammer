import path from 'path'

import camelcase from 'camelcase'
import Listr from 'listr'
import { paramCase } from 'param-case'
import pascalcase from 'pascalcase'
import pluralize from 'pluralize'
import terminalLink from 'terminal-link'

import { ensurePosixPath, getConfig } from '@redwoodjs/internal'

import { generateTemplate, getPaths, writeFilesTask } from 'src/lib'
import c from 'src/lib/colors'

import { yargsDefaults } from '../generate'

/**
 * Reduces boilerplate for generating an output path and content to write to disk
 * for a component.
 */
// TODO: Make this read all the files in a template directory instead of
// manually passing in each file.
export const templateForComponentFile = ({
  name: pathSlashName,
  suffix = '',
  extension = '.js',
  webPathSection,
  apiPathSection,
  generator,
  templatePath,
  templateVars,
  componentName,
  outputPath,
}) => {
  const { name, path: componentPath = '' } = splitPathAndName(pathSlashName)

  let routeName = ''

  if (pathSlashName && pathSlashName.includes(`/`)) {
    const { name: splittedName, path: splittedPath } = splitPathAndName(
      pathSlashName
    )
    if (splittedPath !== '') {
      routeName = camelcase(pascalcase(splittedPath)) + pascalcase(splittedName)
    }
  } else {
    routeName = camelcase(pathSlashName)
  }

  const camelComponentPath = formatCamelPath(componentPath)

  const basePath = webPathSection
    ? getPaths().web[webPathSection]
    : getPaths().api[apiPathSection]
  const outputComponentName =
    componentName || pascalcase(paramCase(name)) + suffix
  const componentOutputPath =
    outputPath ||
    path.join(
      basePath,
      camelComponentPath,
      outputComponentName,
      outputComponentName + extension
    )
  const fullTemplatePath = path.join(generator, 'templates', templatePath)
  const content = generateTemplate(fullTemplatePath, {
    name,
    outputPath: ensurePosixPath(
      `./${path.relative(getPaths().base, componentOutputPath)}`
    ),
    ...templateVars,
    routeName: templatePath === 'page.tsx.template' ? routeName : '',
  })
  return [componentOutputPath, content]
}

/**
 * Creates a route path, either returning the existing path if passed, otherwise
 * creates one based on the name. If the passed path is just a route parameter
 * a new path based on the name is created, with the parameter appended to it
 */
export const pathName = (path, name) => {
  let routePath = path

  if (name && name.includes('/')) {
    const { _name, path: splittedPath } = splitPathAndName(name)
    routePath = `/${formatParamPath(splittedPath)}${paramCase(name)}`
  } else {
    if (path && path.startsWith('{') && path.endsWith('}')) {
      routePath = `/${paramCase(name)}/${path}`
    }

    if (!routePath) {
      routePath = `/${paramCase(name)}`
    }
  }

  return routePath
}

const appendPositionalsToCmd = (commandString, positionalsObj) => {
  // Add positionals like `page <name>` + ` [path]` if specified
  if (Object.keys(positionalsObj).length > 0) {
    const positionalNames = Object.keys(positionalsObj)
      .map((positionalName) => `[${positionalName}]`)
      .join(' ')
    // Note space after command is important
    return `${commandString} ${positionalNames}`
  } else {
    return commandString
  }
}

/**
 * Reduces boilerplate for creating a yargs handler that writes a component/page/layout to a
 * location.
 */
export const createYargsForComponentGeneration = ({
  componentName,
  filesFn,
  optionsObj = yargsDefaults,
  positionalsObj = {},
  includeAdditionalTasks = () => [], // function that takes the options object and returns an array of listr tasks
}) => {
  return {
    command: appendPositionalsToCmd(`${componentName} <name>`, positionalsObj),
    description: `Generate a ${componentName} component`,
    builder: (yargs) => {
      yargs
        .positional('name', {
          description: `Name of the ${componentName}`,
          type: 'string',
        })
        .epilogue(
          `Also see the ${terminalLink(
            'Redwood CLI Reference',
            `https://redwoodjs.com/reference/command-line-interface#generate-${componentName}`
          )}`
        )
        .option('tests', {
          description: 'Generate test files',
          type: 'boolean',
        })
        .option('stories', {
          description: 'Generate storybook files',
          type: 'boolean',
        })

      // Add in passed in positionals
      Object.entries(positionalsObj).forEach(([option, config]) => {
        yargs.positional(option, config)
      })
      // Add in passed in options
      Object.entries(optionsObj).forEach(([option, config]) => {
        yargs.option(option, config)
      })
    },
    handler: async (options) => {
      if (options.tests === undefined) {
        options.tests = getConfig().generate.tests
      }
      if (options.stories === undefined) {
        options.stories = getConfig().generate.stories
      }

      const tasks = new Listr(
        [
          {
            title: `Generating ${componentName} files...`,
            task: async () => {
              const f = await filesFn(options)
              return writeFilesTask(f, { overwriteExisting: options.force })
            },
          },
          ...includeAdditionalTasks(options),
        ],
        { collapse: false, exitOnError: true }
      )

      try {
        await tasks.run()
      } catch (e) {
        console.error(c.error(e.message))
        process.exit(e?.exitCode || 1)
      }
    },
  }
}

// Returns all relations to other models
export const relationsForModel = (model) => {
  return model.fields
    .filter((f) => f.relationName)
    .map((field) => {
      return field.name
    })
}

// Returns only relations that are of datatype Int
export const intForeignKeysForModel = (model) => {
  return model.fields
    .filter((f) => f.name.match(/Id$/) && f.type === 'Int')
    .map((f) => f.name)
}

export const isWordNonPluralizable = (word) => {
  return pluralize.isPlural(word) === pluralize.isSingular(word)
}

/**
 * Adds an s if it can't pluralize the word
 */
export const forcePluralizeWord = (word) => {
  // If word is already plural, check if plural === singular, then add s
  // else use plural
  const shouldAppendList = isWordNonPluralizable(word) // equipment === equipment

  if (shouldAppendList) {
    return pascalcase(`${word}_list`)
  }

  return pluralize.plural(word)
}

// Splits Path and Name or Model from the command argument <path/name>
export const splitPathAndName = (pathSlashName) => {
  const path = pathSlashName.split('/').slice(0, -1).join('/') ?? ''
  // This code will work whether or not there's a path in the name
  // E.g. if the name is just 'post',
  // path.split('/') will return ['post'].
  const name = pathSlashName.split('/').pop()

  return { name, path }
}

// Format path to camelCase
export const formatCamelPath = (path) =>
  path === '' ? path : path.split('/').map(camelcase).join('/') + '/'

// Format path to paramCase
export const formatParamPath = (path) =>
  path === '' ? path : path.split('/').map(paramCase).join('/') + '/'

// Format path to pascalCase
export const formatPascalPath = (path) =>
  path === '' ? path : path.split('/').map(pascalcase).join('/') + '/'
