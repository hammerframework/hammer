import pascalcase from 'pascalcase'
import pluralize from 'pluralize'

import { transformTSToJS } from 'src/lib'
import { getSchema } from 'src/lib'

import { yargsDefaults } from '../../generate'
import {
  templateForComponentFile,
  createYargsForComponentGeneration,
  forcePluralizeWord,
  isWordNonPluralizable,
  splitPathAndName,
} from '../helpers'

const COMPONENT_SUFFIX = 'Cell'
const REDWOOD_WEB_PATH_NAME = 'components'

const getCellOperationNames = async () => {
  const { getProject } = await import('@redwoodjs/structure')

  return getProject()
    .cells.map((x) => {
      return x.queryOperationName
    })
    .filter(Boolean)
}

const uniqueOperationName = async (name, { index = 1, list = false }) => {
  const { name: splittedName } = splitPathAndName(name)

  let operationName = pascalcase(
    index <= 1
      ? `find_${splittedName}_query`
      : `find_${splittedName}_query_${index}`
  )

  if (list) {
    operationName =
      index <= 1
        ? `${pascalcase(splittedName)}Query`
        : `${pascalcase(splittedName)}Query_${index}`
  }

  const cellOperationNames = await getCellOperationNames()
  if (!cellOperationNames.includes(operationName)) {
    return operationName
  }

  return uniqueOperationName(splittedName, { index: index + 1 })
}

const getIdType = (model) => {
  return model.fields.find((field) => field.isId)?.type
}

export const files = async ({
  name,
  typescript: generateTypescript,
  ...options
}) => {
  let cellName = name
  let idType,
    model = null
  let templateNameSuffix = ''

  // Create a unique operation name.

  const shouldGenerateList =
    (isWordNonPluralizable(name) ? options.list : pluralize.isPlural(name)) ||
    options.list

  if (shouldGenerateList) {
    cellName = forcePluralizeWord(name)
    templateNameSuffix = 'List'
    // override operationName so that its find_operationName
  } else {
    // needed for the singular cell GQL query find by id case
    try {
      model = await getSchema(pascalcase(pluralize.singular(name)))
      idType = getIdType(model)
    } catch {
      // eat error so that the destroy cell generator doesn't raise when try to find prisma query engine in test runs
      // assume id will be Int, otherwise generated will keep throwing
      idType = 'Int'
    }
  }

  const operationName = await uniqueOperationName(cellName, {
    list: shouldGenerateList,
  })

  const cellFile = templateForComponentFile({
    name: cellName,
    suffix: COMPONENT_SUFFIX,
    extension: generateTypescript ? '.tsx' : '.js',
    webPathSection: REDWOOD_WEB_PATH_NAME,
    generator: 'cell',
    templatePath: `cell${templateNameSuffix}.tsx.template`,
    templateVars: {
      operationName,
      idType,
    },
  })

  const testFile = templateForComponentFile({
    name: cellName,
    suffix: COMPONENT_SUFFIX,
    extension: generateTypescript ? '.test.tsx' : '.test.js',
    webPathSection: REDWOOD_WEB_PATH_NAME,
    generator: 'cell',
    templatePath: 'test.js.template',
  })

  const storiesFile = templateForComponentFile({
    name: cellName,
    suffix: COMPONENT_SUFFIX,
    extension: generateTypescript ? '.stories.tsx' : '.stories.js',
    webPathSection: REDWOOD_WEB_PATH_NAME,
    generator: 'cell',
    templatePath: 'stories.js.template',
  })

  const mockFile = templateForComponentFile({
    name: cellName,
    suffix: COMPONENT_SUFFIX,
    extension: generateTypescript ? '.mock.ts' : '.mock.js',
    webPathSection: REDWOOD_WEB_PATH_NAME,
    generator: 'cell',
    templatePath: `mock${templateNameSuffix}.js.template`,
  })

  const files = [cellFile]

  if (options.stories) {
    files.push(storiesFile)
  }

  if (options.tests) {
    files.push(testFile)
  }

  if (options.stories || options.tests) {
    files.push(mockFile)
  }

  // Returns
  // {
  //    "path/to/fileA": "<<<template>>>",
  //    "path/to/fileB": "<<<template>>>",
  // }
  return files.reduce((acc, [outputPath, content]) => {
    const template = generateTypescript
      ? content
      : transformTSToJS(outputPath, content)

    return {
      [outputPath]: template,
      ...acc,
    }
  }, {})
}

export const {
  command,
  description,
  builder,
  handler,
} = createYargsForComponentGeneration({
  componentName: 'cell',
  filesFn: files,
  optionsObj: {
    ...yargsDefaults,
    list: {
      alias: 'l',
      default: false,
      description:
        'Use when you want to generate a cell for a list of the model name.',
      type: 'boolean',
    },
  },
})
