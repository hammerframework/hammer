import fs from 'fs'
import path from 'path'

import camelcase from 'camelcase'
import humanize from 'humanize-string'
import Listr from 'listr'
import { paramCase } from 'param-case'
import pascalcase from 'pascalcase'
import pluralize from 'pluralize'
import terminalLink from 'terminal-link'

import { getConfig } from '@redwoodjs/internal'

import {
  generateTemplate,
  templateRoot,
  readFile,
  writeFile,
  asyncForEach,
  getSchema,
  getDefaultArgs,
  getPaths,
  writeFilesTask,
  addRoutesToRouterTask,
} from 'src/lib'
import c from 'src/lib/colors'

import { yargsDefaults } from '../../generate'
import {
  relationsForModel,
  intForeignKeysForModel,
  ensureUniquePlural,
} from '../helpers'
import { files as sdlFiles, builder as sdlBuilder } from '../sdl/sdl'
import {
  files as serviceFiles,
  builder as serviceBuilder,
} from '../service/service'

const NON_EDITABLE_COLUMNS = ['id', 'createdAt', 'updatedAt']
const SCAFFOLD_STYLE_PATH = './scaffold.css'
// Any assets that should not trigger an overwrite error and require a --force
const SKIPPABLE_ASSETS = ['scaffold.css']
const PACKAGE_SET = 'Set'

const getIdType = (model) => {
  return model.fields.find((field) => field.isId)?.type
}

const getImportComponentNames = (
  name,
  scaffoldPath,
  nestScaffoldByModel = true
) => {
  const pluralName = pascalcase(pluralize(name))
  const singularName = pascalcase(pluralize.singular(name))
  let componentPath
  let layoutPath
  if (scaffoldPath === '') {
    componentPath = nestScaffoldByModel
      ? `src/components/${singularName}`
      : `src/components`
    layoutPath = `src/layouts`
  } else {
    const sP = scaffoldPath.split('/').map(pascalcase).join('/')
    componentPath = nestScaffoldByModel
      ? `src/components/${sP}/${singularName}`
      : `src/components/${sP}`
    layoutPath = `src/layouts/${sP}`
  }

  return {
    importComponentName: `${componentPath}/${singularName}`,
    importComponentNameCell: `${componentPath}/${singularName}Cell`,
    importComponentEditNameCell: `${componentPath}/Edit${singularName}Cell`,
    importComponentNameForm: `${componentPath}/${singularName}Form`,
    importComponentNewName: `${componentPath}/New${singularName}`,
    importComponentNames: `${componentPath}/${pluralName}`,
    importComponentNamesCell: `${componentPath}/${pluralName}Cell`,
    importLayoutNames: `${layoutPath}/${pluralName}Layout`,
  }
}

// Includes imports from getImportComponentNames()
const getTemplateStrings = (name, scaffoldPath, nestScaffoldByModel = true) => {
  const pluralPascalName = pascalcase(pluralize(name))
  const singularPascalName = pascalcase(pluralize.singular(name))

  const pluralCamelName = camelcase(pluralPascalName)
  const singularCamelName = camelcase(singularPascalName)
  const camelScaffoldPath = camelcase(pascalcase(scaffoldPath))

  return {
    pluralRouteName:
      scaffoldPath === ''
        ? pluralCamelName
        : `${camelScaffoldPath}${pluralPascalName}`,

    editRouteName:
      scaffoldPath === ''
        ? `edit${singularPascalName}`
        : `${camelScaffoldPath}Edit${singularPascalName}`,

    singularRouteName:
      scaffoldPath === ''
        ? singularCamelName
        : `${camelScaffoldPath}${singularPascalName}`,

    newRouteName:
      scaffoldPath === ''
        ? `new${singularPascalName}`
        : `${camelScaffoldPath}New${singularPascalName}`,
    ...getImportComponentNames(name, scaffoldPath, nestScaffoldByModel),
  }
}

export const files = async ({
  model: name,
  path: scaffoldPath = '',
  tests = true,
  typescript = false,
  nestScaffoldByModel,
}) => {
  const model = await getSchema(pascalcase(pluralize.singular(name)))
  if (typeof nestScaffoldByModel === 'undefined') {
    nestScaffoldByModel = getConfig().generate.nestScaffoldByModel
  }
  const templateStrings = getTemplateStrings(
    name,
    scaffoldPath,
    nestScaffoldByModel
  )
  const pascalScaffoldPath =
    scaffoldPath === ''
      ? scaffoldPath
      : scaffoldPath.split('/').map(pascalcase).join('/') + '/'

  return {
    ...(await sdlFiles({
      ...getDefaultArgs(sdlBuilder),
      name,
      crud: true,
      typescript,
    })),
    ...(await serviceFiles({
      ...getDefaultArgs(serviceBuilder),
      name,
      crud: true,
      relations: relationsForModel(model),
      tests,
      typescript,
    })),
    ...assetFiles(name),
    ...layoutFiles(name, pascalScaffoldPath, typescript, templateStrings),
    ...pageFiles(
      name,
      pascalScaffoldPath,
      typescript,
      nestScaffoldByModel,
      templateStrings
    ),
    ...(await componentFiles(
      name,
      pascalScaffoldPath,
      typescript,
      nestScaffoldByModel,
      templateStrings
    )),
  }
}

const assetFiles = (name) => {
  let fileList = {}
  const assets = fs.readdirSync(
    path.join(templateRoot, 'scaffold', 'templates', 'assets')
  )

  assets.forEach((asset) => {
    const outputAssetName = asset.replace(/\.template/, '')
    const outputPath = path.join(getPaths().web.src, outputAssetName)

    // skip assets that already exist on disk, never worry about overwriting
    if (
      !SKIPPABLE_ASSETS.includes(path.basename(outputPath)) ||
      !fs.existsSync(outputPath)
    ) {
      const template = generateTemplate(
        path.join('scaffold', 'templates', 'assets', asset),
        {
          name,
        }
      )
      fileList[outputPath] = template
    }
  })

  return fileList
}

const layoutFiles = (
  name,
  pascalScaffoldPath = '',
  generateTypescript,
  templateStrings
) => {
  const pluralName = pascalcase(pluralize(name))
  const singularName = pascalcase(pluralize.singular(name))
  let fileList = {}

  const layouts = fs.readdirSync(
    path.join(templateRoot, 'scaffold', 'templates', 'layouts')
  )

  layouts.forEach((layout) => {
    const outputLayoutName = layout
      .replace(/Names/, pluralName)
      .replace(/Name/, singularName)
      .replace(/\.js\.template/, generateTypescript ? '.tsx' : '.js')

    const outputPath = path.join(
      getPaths().web.layouts,
      pascalScaffoldPath,
      outputLayoutName.replace(/\.(js|tsx?)/, ''),
      outputLayoutName
    )
    const template = generateTemplate(
      path.join('scaffold', 'templates', 'layouts', layout),
      {
        name,
        pascalScaffoldPath,
        ...templateStrings,
      }
    )
    fileList[outputPath] = template
  })

  return fileList
}

const pageFiles = (
  name,
  pascalScaffoldPath = '',
  generateTypescript,
  nestScaffoldByModel = true,
  templateStrings
) => {
  const pluralName = pascalcase(pluralize(name))
  const singularName = pascalcase(pluralize.singular(name))
  let fileList = {}

  const pages = fs.readdirSync(
    path.join(templateRoot, 'scaffold', 'templates', 'pages')
  )

  pages.forEach((page) => {
    // Sanitize page names
    const outputPageName = page
      .replace(/Names/, pluralName)
      .replace(/Name/, singularName)
      .replace(/\.js\.template/, generateTypescript ? '.tsx' : '.js')

    const finalFolder =
      (nestScaffoldByModel ? singularName + '/' : '') +
      outputPageName.replace(/\.(js|tsx?)/, '')

    const outputPath = path.join(
      getPaths().web.pages,
      pascalScaffoldPath,
      finalFolder,
      outputPageName
    )
    const template = generateTemplate(
      path.join('scaffold', 'templates', 'pages', page),
      {
        name,
        pascalScaffoldPath,
        ...templateStrings,
      }
    )
    fileList[outputPath] = template
  })

  return fileList
}

const componentFiles = async (
  name,
  pascalScaffoldPath = '',
  generateTypescript,
  nestScaffoldByModel = true,
  templateStrings
) => {
  const pluralName = pascalcase(pluralize(name))
  const singularName = pascalcase(pluralize.singular(name))
  const model = await getSchema(singularName)
  const idType = getIdType(model)
  const intForeignKeys = intForeignKeysForModel(model)
  let fileList = {}
  const componentMetadata = {
    Boolean: {
      componentName: 'CheckboxField',
      defaultProp: 'defaultChecked',
      validation: false,
      listDisplayFunction: 'checkboxInputTag',
      displayFunction: 'checkboxInputTag',
    },
    DateTime: {
      componentName: 'DatetimeLocalField',
      deserilizeFunction: 'formatDatetime',
      listDisplayFunction: 'timeTag',
      displayFunction: 'timeTag',
    },
    Int: {
      componentName: 'NumberField',
    },
    Json: {
      componentName: 'TextAreaField',
      transformValue: 'Json',
      displayFunction: 'jsonDisplay',
      listDisplayFunction: 'jsonTruncate',
      deserilizeFunction: 'JSON.stringify',
    },
    Float: {
      transformValue: 'Float',
    },
    default: {
      componentName: 'TextField',
      defaultProp: 'defaultValue',
      deserilizeFunction: '',
      validation: '{{ required: true }}',
      displayFunction: undefined,
      listDisplayFunction: 'truncate',
      transformValue: undefined,
    },
  }
  const columns = model.fields
    .filter((field) => field.kind !== 'object')
    .map((column) => ({
      ...column,
      label: humanize(column.name),
      component:
        componentMetadata[column.type]?.componentName ||
        componentMetadata.default.componentName,
      defaultProp:
        componentMetadata[column.type]?.defaultProp ||
        componentMetadata.default.defaultProp,
      deserilizeFunction:
        componentMetadata[column.type]?.deserilizeFunction ||
        componentMetadata.default.deserilizeFunction,
      validation:
        componentMetadata[column.type]?.validation ??
        componentMetadata.default.validation,
      listDisplayFunction:
        componentMetadata[column.type]?.listDisplayFunction ||
        componentMetadata.default.listDisplayFunction,
      displayFunction:
        componentMetadata[column.type]?.displayFunction ||
        componentMetadata.default.displayFunction,
      transformValue:
        componentMetadata[column.type]?.transformValue ||
        componentMetadata.default.transformValue,
    }))
  const editableColumns = columns.filter((column) => {
    return NON_EDITABLE_COLUMNS.indexOf(column.name) === -1
  })
  const fieldsToImport = Object.keys(
    editableColumns.reduce((accumulator, column) => {
      accumulator[column.component] = true
      return accumulator
    }, {})
  )

  const components = fs.readdirSync(
    path.join(templateRoot, 'scaffold', 'templates', 'components')
  )

  await asyncForEach(components, (component) => {
    const outputComponentName = component
      .replace(/Names/, pluralName)
      .replace(/Name/, singularName)
      .replace(/\.js\.template/, generateTypescript ? '.tsx' : '.js')

    const finalFolder =
      (nestScaffoldByModel ? singularName + '/' : '') +
      outputComponentName.replace(/\.(js|tsx?)/, '')

    const outputPath = path.join(
      getPaths().web.components,
      pascalScaffoldPath,
      finalFolder,
      outputComponentName
    )

    const template = generateTemplate(
      path.join('scaffold', 'templates', 'components', component),
      {
        name,
        columns,
        fieldsToImport,
        editableColumns,
        idType,
        intForeignKeys,
        pascalScaffoldPath,
        ...templateStrings,
      }
    )
    fileList[outputPath] = template
  })

  return fileList
}

// add routes for all pages
export const routes = async ({
  model: name,
  path: scaffoldPath = '',
  nestScaffoldByModel,
}) => {
  if (typeof nestScaffoldByModel === 'undefined') {
    nestScaffoldByModel = getConfig().generate.nestScaffoldByModel
  }

  const templateNames = getTemplateStrings(name, scaffoldPath)
  const singularPascalName = pascalcase(pluralize.singular(name))
  const pluralPascalName = pascalcase(pluralize(name))
  const pluralParamName = paramCase(pluralPascalName)
  const model = await getSchema(singularPascalName)
  const idRouteParam = getIdType(model) === 'Int' ? ':Int' : ''

  const paramScaffoldPath =
    scaffoldPath === ''
      ? scaffoldPath
      : scaffoldPath.split('/').map(paramCase).join('/') + '/'
  const pascalScaffoldPath = pascalcase(scaffoldPath)

  const pageRoot =
    pascalScaffoldPath + (nestScaffoldByModel ? singularPascalName : '')

  return [
    // new
    `<Route path="/${paramScaffoldPath}${pluralParamName}/new" page={${pageRoot}New${singularPascalName}Page} name="${templateNames.newRouteName}" />`,
    // edit
    `<Route path="/${paramScaffoldPath}${pluralParamName}/{id${idRouteParam}}/edit" page={${pageRoot}Edit${singularPascalName}Page} name="${templateNames.editRouteName}" />`,
    // singular
    `<Route path="/${paramScaffoldPath}${pluralParamName}/{id${idRouteParam}}" page={${pageRoot}${singularPascalName}Page} name="${templateNames.singularRouteName}" />`,
    // plural
    `<Route path="/${paramScaffoldPath}${pluralParamName}" page={${pageRoot}${pluralPascalName}Page} name="${templateNames.pluralRouteName}" />`,
  ]
}

const addRoutesInsideSetToRouter = async (model, path) => {
  const pluralPascalName = pascalcase(pluralize(model))
  const layoutName = `${pluralPascalName}Layout`
  return addRoutesToRouterTask(await routes({ model, path }), layoutName)
}

const addLayoutImport = ({ model: name, path: scaffoldPath = '' }) => {
  const pluralPascalName = pascalcase(pluralize(name))
  const pascalScaffoldPath =
    scaffoldPath === ''
      ? scaffoldPath
      : scaffoldPath.split('/').map(pascalcase).join('/') + '/'
  const layoutName = `${pluralPascalName}Layout`
  const importLayout = `import ${pluralPascalName}Layout from 'src/layouts/${pascalScaffoldPath}${layoutName}'`
  const routesPath = getPaths().web.routes
  const routesContent = readFile(routesPath).toString()

  const newRoutesContent = routesContent.replace(
    /'@redwoodjs\/router'(\s*)/,
    `'@redwoodjs/router'\n${importLayout}$1`
  )
  writeFile(routesPath, newRoutesContent, { overwriteExisting: true })

  return 'Added layout import to Routes.{js,tsx}'
}

const addSetImport = () => {
  const routesPath = getPaths().web.routes
  const routesContent = readFile(routesPath).toString()
  const [redwoodRouterImport, importStart, spacing, importContent, importEnd] =
    routesContent.match(/(import {)(\s*)([^]*)(} from '@redwoodjs\/router')/) ||
    []
  const routerImports = importContent.replace(/\s/g, '').split(',')
  if (routerImports.includes(PACKAGE_SET)) {
    return 'Skipping Set import'
  }
  const newRoutesContent = routesContent.replace(
    redwoodRouterImport,
    importStart +
      spacing +
      PACKAGE_SET +
      `,` +
      spacing +
      importContent +
      importEnd
  )

  writeFile(routesPath, newRoutesContent, { overwriteExisting: true })

  return 'Added Set import to Routes.{js,tsx}'
}

const addScaffoldImport = () => {
  const appJsPath = getPaths().web.app
  let appJsContents = readFile(appJsPath).toString()

  if (appJsContents.match(SCAFFOLD_STYLE_PATH)) {
    return 'Skipping scaffold style include'
  }

  appJsContents = appJsContents.replace(
    "import Routes from 'src/Routes'\n",
    `import Routes from 'src/Routes'\n\nimport '${SCAFFOLD_STYLE_PATH}'`
  )
  writeFile(appJsPath, appJsContents, { overwriteExisting: true })

  return 'Added scaffold import to App.{js,tsx}'
}

export const command = 'scaffold <model>'
export const description =
  'Generate Pages, SDL, and Services files based on a given DB schema Model. Also accepts <path/model>'
export const builder = (yargs) => {
  yargs
    .positional('model', {
      description:
        "Model to scaffold. You can also use <path/model> to nest files by type at the given path directory (or directories). For example, 'rw g scaffold admin/post'",
    })
    .option('tests', {
      description: 'Generate test files',
      type: 'boolean',
    })
    .epilogue(
      `Also see the ${terminalLink(
        'Redwood CLI Reference',
        'https://redwoodjs.com/reference/command-line-interface#generate-scaffold'
      )}`
    )

  // Merge generator defaults in
  Object.entries(yargsDefaults).forEach(([option, config]) => {
    yargs.option(option, config)
  })
}
const tasks = ({ model, path, force, tests, typescript, javascript }) => {
  return new Listr(
    [
      {
        title: 'Generating scaffold files...',
        task: async () => {
          const f = await files({ model, path, tests, typescript, javascript })
          return writeFilesTask(f, { overwriteExisting: force })
        },
      },
      {
        title: 'Adding layout import...',
        task: async () => addLayoutImport({ model, path }),
      },
      {
        title: 'Adding set import...',
        task: async () => addSetImport({ model, path }),
      },
      {
        title: 'Adding scaffold routes...',
        task: async () => addRoutesInsideSetToRouter(model, path),
      },
      {
        title: 'Adding scaffold asset imports...',
        task: () => addScaffoldImport(),
      },
    ],
    { collapse: false, exitOnError: true }
  )
}

export const handler = async ({
  model: modelArg,
  force,
  tests,
  typescript,
}) => {
  if (tests === undefined) {
    tests = getConfig().generate.tests
  }
  const { model, path } = splitPathAndModel(modelArg)
  await ensureUniquePlural({ model })

  const t = tasks({ model, path, force, tests, typescript })
  try {
    await t.run()
  } catch (e) {
    console.log(c.error(e.message))
  }
}

export const splitPathAndModel = (pathSlashModel) => {
  const path = pathSlashModel.split('/').slice(0, -1).join('/')
  // This code will work whether or not there's a path in model
  // E.g. if model is just 'post',
  // path.split('/') will return ['post'].
  const model = pathSlashModel.split('/').pop()

  return { model, path }
}
