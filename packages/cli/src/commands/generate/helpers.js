import path from 'path'

import Listr from 'listr'
import { paramCase } from 'param-case'
import pascalcase from 'pascalcase'
import pluralize from 'pluralize'
import prompts from 'prompts'
import terminalLink from 'terminal-link'

import { ensurePosixPath, getConfig } from '@redwoodjs/internal'

import { generateTemplate, getPaths, writeFilesTask } from '../../lib'
import c from '../../lib/colors'
import { yargsDefaults } from '../generate'

/**
 * Reduces boilerplate for generating an output path and content to write to disk
 * for a component.
 */
// TODO: Make this read all the files in a template directory instead of
// manually passing in each file.
export const templateForComponentFile = ({
  name,
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
  const basePath = webPathSection
    ? getPaths().web[webPathSection]
    : getPaths().api[apiPathSection]
  const outputComponentName =
    componentName || pascalcase(paramCase(name)) + suffix
  const componentOutputPath =
    outputPath ||
    path.join(basePath, outputComponentName, outputComponentName + extension)
  const fullTemplatePath = path.join(generator, 'templates', templatePath)
  const content = generateTemplate(fullTemplatePath, {
    name,
    outputPath: ensurePosixPath(
      `./${path.relative(getPaths().base, componentOutputPath)}`
    ),
    ...templateVars,
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

  if (path && path.startsWith('{') && path.endsWith('}')) {
    routePath = `/${paramCase(name)}/${path}`
  }

  if (!routePath) {
    routePath = `/${paramCase(name)}`
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
  shouldEnsureUniquePlural = false,
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

      if (shouldEnsureUniquePlural) {
        await ensureUniquePlural({ model: options.name })
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

export const validatePlural = (plural, singular) => {
  const trimmedPlural = plural.trim()
  if (trimmedPlural === singular) {
    return 'Plural can not be same as singular.'
  }
  if (trimmedPlural.match(/[\n\r\s]+/)) {
    return 'Only one word please!'
  }
  // Control Char u0017 is retured if default input is cleared in the prompt using option+backspace
  // eslint-disable-next-line no-control-regex
  if (trimmedPlural.match(/^[\n\r\s\u0017]*$/)) {
    return 'Plural can not be empty.'
  }
  return true
}

// Ask user for plural version, if singular & plural are same for a word. For example: Pokemon
export const ensureUniquePlural = async ({ model, inDestroyer = false }) => {
  if (!isWordNonPluralizable(model)) {
    return
  }

  const promptMessage = inDestroyer
    ? `Cannot determine the plural of "${model}" originally used to generate scaffolding. \nTo continue, the destroy command requires the plural form:`
    : `Cannot determine the plural of "${model}". \nTo continue, the generator requires a unique plural form:`
  const initialPlural = model.slice(-1) === 's' ? `${model}es` : `${model}s` // News => Newses; Equipment => Equipments
  const promptResult = await prompts({
    type: 'text',
    name: 'plural',
    message: promptMessage,
    initial: initialPlural,
    validate: (pluralInput) => validatePlural(pluralInput, model),
  })

  // Quickfix is to remove that control char u0017, which is preprended if default input is cleared using option+backspace
  // eslint-disable-next-line no-control-regex
  const pluralToUse = promptResult.plural?.trim().replace(/\u0017/g, '')
  if (!pluralToUse) {
    throw Error('Plural name must not be empty')
  }

  // Set the rule
  pluralize.addIrregularRule(model, pluralToUse)
}
