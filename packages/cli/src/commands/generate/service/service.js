import camelcase from 'camelcase'
import pascalcase from 'pascalcase'
import pluralize from 'pluralize'
import terminalLink from 'terminal-link'

import { getSchema, transformTSToJS } from 'src/lib'

import { yargsDefaults } from '../../generate'
import {
  templateForComponentFile,
  createYargsForComponentGeneration,
} from '../helpers'

const DEFAULT_SCENARIO_NAMES = ['one', 'two']

// parses the schema into scalar fields, relations and an array of foreign keys
export const parseSchema = async (model) => {
  const schema = await getSchema(model)
  const relations = {}
  let foreignKeys = []

  // aggregate the plain String, Int and DateTime fields
  let scalarFields = schema.fields.filter((field) => {
    if (field.relationFromFields) {
      // only build relations for those that are required
      if (field.isRequired && field.relationFromFields.length !== 0) {
        relations[field.name] = {
          foreignKey: field.relationFromFields,
          type: field.type,
        }
      }
      foreignKeys = foreignKeys.concat(field.relationFromFields)
    }

    return (
      field.isRequired &&
      !field.hasDefaultValue && // don't include fields that the database will default
      !field.relationName // this field isn't a relation (ie. comment.post)
    )
  })

  return { scalarFields, relations, foreignKeys }
}

export const scenarioFieldValue = (field) => {
  const randFloat = Math.random() * 10000000
  const randInt = parseInt(Math.random() * 10000000)

  switch (field.type) {
    case 'String':
      return field.isUnique ? `String${randInt}` : 'String'
    case 'Boolean':
      return true
    case 'Decimal':
      return randFloat
    case 'Int':
      return randInt
    case 'DateTime':
      return new Date().toISOString().replace(/\.\d{3}/, '')
    case 'Json':
      return { foo: 'bar' }
    default: {
      if (field.kind === 'enum' && field.enumValues[0]) {
        return field.enumValues[0].dbName || field.enumValues[0].name
      }
    }
  }
}

export const fieldsToScenario = async (
  scalarFields,
  relations,
  foreignKeys
) => {
  const data = {}

  // remove foreign keys from scalars
  scalarFields.forEach((field) => {
    if (!foreignKeys.length || !foreignKeys.includes(field.name)) {
      data[field.name] = scenarioFieldValue(field)
    }
  })

  // add back in related models by name so they can be created with prisma create syntax
  for (const [relationName, relData] of Object.entries(relations)) {
    const relationModelName = relData.type
    const {
      scalarFields: relScalarFields,
      relations: relRelations,
      foreignKeys: relForeignKeys,
    } = await parseSchema(relationModelName)

    data[relationName] = {
      create: await fieldsToScenario(
        relScalarFields,
        relRelations,
        relForeignKeys
      ),
    }
  }

  return data
}

// creates the scenario data based on the data definitions in schema.prisma
export const buildScenario = async (model) => {
  const scenarioModelName = camelcase(model)
  const standardScenario = {
    [scenarioModelName]: {},
  }
  const { scalarFields, relations, foreignKeys } = await parseSchema(model)

  // turn scalar fields into actual scenario data
  for (const name of DEFAULT_SCENARIO_NAMES) {
    standardScenario[scenarioModelName][name] = await fieldsToScenario(
      scalarFields,
      relations,
      foreignKeys
    )
  }

  return standardScenario
}

// outputs fields necessary to create an object in the test file
export const fieldsToInput = async (model) => {
  const { scalarFields, foreignKeys } = await parseSchema(model)
  const modelName = camelcase(pluralize.singular(model))
  let inputObj = {}

  scalarFields.forEach((field) => {
    if (foreignKeys.includes(field.name)) {
      inputObj[field.name] = `scenario.${modelName}.two.${field.name}`
    } else {
      inputObj[field.name] = scenarioFieldValue(field)
    }
  })

  if (Object.keys(inputObj).length > 0) {
    return inputObj
  } else {
    return false
  }
}

// outputs fields necessary to update an object in the test file
export const fieldsToUpdate = async (model) => {
  const { scalarFields, relations, foreignKeys } = await parseSchema(model)
  const modelName = camelcase(pluralize.singular(model))
  let field, newValue, fieldName

  // find an editable scalar field, ideally one that isn't a foreign key
  field = scalarFields.find((scalar) => !foreignKeys.includes(scalar.name))

  // no non-foreign keys, so just take the first one
  if (!field) {
    field = scalarFields[0]
  }

  // if the model has no editable scalar fields, skip update test completely
  if (!field) {
    return false
  }

  if (foreignKeys.includes(field.name)) {
    // no scalar fields, change a relation field instead
    // { post: { foreignKey: [ 'postId' ], type: "Post" }, tag: { foreignKey: [ 'tagId' ], type: "Post" } }
    fieldName = Object.values(relations)[0].foreignKey
    newValue = `scenario.${modelName}.two.${field.name}`
  } else {
    fieldName = field.name

    // change scalar fields
    const value = scenarioFieldValue(field)
    newValue = value

    // depending on the field type, append/update the value to something different
    switch (field.type) {
      case 'String': {
        newValue = newValue + '2'
        break
      }
      case 'Int': {
        newValue = newValue + 1
        break
      }
      case 'Decimal': {
        newValue = newValue + 1.1
        break
      }
      case 'Boolean': {
        newValue = !value
        break
      }
      case 'DateTime': {
        let date = new Date()
        date.setDate(date.getDate() + 1)
        newValue = date.toISOString().replace(/\.\d{3}/, '')
        break
      }
      case 'Json': {
        newValue = { foo: 'baz' }
        break
      }
      default: {
        if (
          field.kind === 'enum' &&
          field.enumValues[field.enumValues.length - 1]
        ) {
          const enumVal = field.enumValues[field.enumValues.length - 1]
          newValue = enumVal.dbName || enumVal.name
        }
        break
      }
    }
  }

  return { [fieldName]: newValue }
}

export const files = async ({
  name,
  tests,
  relations,
  typescript,
  ...rest
}) => {
  const componentName = camelcase(pluralize(name))
  const model = pascalcase(pluralize.singular(name))
  const extension = 'ts'
  const serviceFile = templateForComponentFile({
    name,
    componentName: componentName,
    extension: `.${extension}`,
    apiPathSection: 'services',
    generator: 'service',
    templatePath: `service.${extension}.template`,
    templateVars: { relations: relations || [], ...rest },
  })
  const testFile = templateForComponentFile({
    name,
    componentName: componentName,
    extension: `.test.${extension}`,
    apiPathSection: 'services',
    generator: 'service',
    templatePath: `test.${extension}.template`,
    templateVars: {
      relations: relations || [],
      create: await fieldsToInput(model),
      update: await fieldsToUpdate(model),
      ...rest,
    },
  })
  const scenariosFile = templateForComponentFile({
    name,
    componentName: componentName,
    extension: `.scenarios.${extension}`,
    apiPathSection: 'services',
    generator: 'service',
    templatePath: `scenarios.${extension}.template`,
    templateVars: {
      scenario: await buildScenario(model),
      prismaTypeName: `${model}CreateArgs`,
      ...rest,
    },
  })

  const files = [serviceFile]
  if (tests) {
    files.push(testFile)
    files.push(scenariosFile)
  }

  // Returns
  // {
  //    "path/to/fileA": "<<<template>>>",
  //    "path/to/fileB": "<<<template>>>",
  // }
  return files.reduce((acc, [outputPath, content]) => {
    if (!typescript) {
      content = transformTSToJS(outputPath, content)
      outputPath = outputPath.replace('.ts', '.js')
    }

    return {
      [outputPath]: content,
      ...acc,
    }
  }, {})
}

export const defaults = {
  ...yargsDefaults,
  tests: {
    description: 'Generate test files',
    type: 'boolean',
  },
  crud: {
    default: false,
    description: 'Create CRUD functions',
    type: 'boolean',
  },
}

export const builder = (yargs) => {
  yargs
    .positional('name', {
      description: 'Name of the service',
      type: 'string',
    })
    .epilogue(
      `Also see the ${terminalLink(
        'Redwood CLI Reference',
        'https://redwoodjs.com/reference/command-line-interface#generate-service'
      )}`
    )
  Object.entries(defaults).forEach(([option, config]) => {
    yargs.option(option, config)
  })
}

export const { command, description, handler } =
  createYargsForComponentGeneration({
    componentName: 'service',
    filesFn: files,
    shouldEnsureUniquePlural: true,
  })
