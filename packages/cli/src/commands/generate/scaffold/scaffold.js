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
  splitPathAndName,
  formatCamelPath,
  formatParamPath,
  formatPascalPath,
} from '../helpers'
import { files as sdlFiles, builder as sdlBuilder } from '../sdl/sdl'
import {
  files as serviceFiles,
  builder as serviceBuilder,
} from '../service/service'

const NON_EDITABLE_COLUMNS = ['id', 'createdAt', 'updatedAt']
const ASSETS = fs.readdirSync(
  path.join(templateRoot, 'scaffold', 'templates', 'assets')
)
const LAYOUTS = fs.readdirSync(
  path.join(templateRoot, 'scaffold', 'templates', 'layouts')
)
const PAGES = fs.readdirSync(
  path.join(templateRoot, 'scaffold', 'templates', 'pages')
)
const COMPONENTS = fs.readdirSync(
  path.join(templateRoot, 'scaffold', 'templates', 'components')
)
const SCAFFOLD_STYLE_PATH = './scaffold.css'
// Any assets that should not trigger an overwrite error and require a --force
const SKIPPABLE_ASSETS = ['scaffold.css']
const PACKAGE_SET = 'Set'

const getIdType = (model) => {
  return model.fields.find((field) => field.isId)?.type
}

export const files = async ({
  model: name,
  path: scaffoldPath = '',
  tests,
  typescript = false,
}) => {
  const model = await getSchema(pascalcase(pluralize.singular(name)))

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
    ...layoutFiles(name, scaffoldPath, typescript),
    ...pageFiles(name, scaffoldPath, typescript),
    ...(await componentFiles(name, scaffoldPath, typescript)),
  }
}

const assetFiles = (name) => {
  let fileList = {}

  ASSETS.forEach((asset) => {
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

const layoutFiles = (name, scaffoldPath = '', generateTypescript) => {
  const pluralName = pascalcase(pluralize(name))
  const singularName = pascalcase(pluralize.singular(name))
  let fileList = {}

  const scaffoldPathCamel = formatCamelPath(scaffoldPath)

  const pluralCamelName = camelcase(pluralName)
  const camelScaffoldPath = camelcase(pascalcase(scaffoldPath))

  const pluralRouteName =
    scaffoldPath === '' ? pluralCamelName : `${camelScaffoldPath}${pluralName}`

  const newRouteName =
    scaffoldPath === ''
      ? `new${singularName}`
      : `${camelScaffoldPath}New${singularName}`

  LAYOUTS.forEach((layout) => {
    const outputLayoutName = layout
      .replace(/Names/, pluralName)
      .replace(/Name/, singularName)
      .replace(/\.js\.template/, generateTypescript ? '.tsx' : '.js')

    const outputPath = path.join(
      getPaths().web.layouts,
      scaffoldPathCamel,
      outputLayoutName.replace(/\.(js|tsx?)/, ''),
      outputLayoutName
    )
    const template = generateTemplate(
      path.join('scaffold', 'templates', 'layouts', layout),
      {
        name,
        scaffoldPathCamel,
        pluralRouteName,
        newRouteName,
      }
    )
    fileList[outputPath] = template
  })

  return fileList
}

const pageFiles = (name, scaffoldPath = '', generateTypescript) => {
  const pluralName = pascalcase(pluralize(name))
  const singularName = pascalcase(pluralize.singular(name))
  let fileList = {}

  const pascalScaffoldPath = formatPascalPath(scaffoldPath)

  const camelScaffoldPath = formatCamelPath(scaffoldPath)

  PAGES.forEach((page) => {
    // Sanitize page names
    const outputPageName = page
      .replace(/Names/, pluralName)
      .replace(/Name/, singularName)
      .replace(/\.js\.template/, generateTypescript ? '.tsx' : '.js')

    const outputPath = path.join(
      getPaths().web.pages,
      pascalScaffoldPath,
      outputPageName.replace(/\.(js|tsx?)/, ''),
      outputPageName
    )
    const template = generateTemplate(
      path.join('scaffold', 'templates', 'pages', page),
      {
        name,
        pascalScaffoldPath,
        camelScaffoldPath,
      }
    )
    fileList[outputPath] = template
  })

  return fileList
}

const componentFiles = async (name, scaffoldPath = '', generateTypescript) => {
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
      dataType: 'Json',
      displayFunction: 'jsonDisplay',
      listDisplayFunction: 'jsonTruncate',
      deserilizeFunction: 'JSON.stringify',
    },
    Float: {
      dataType: 'Float',
    },
    default: {
      componentName: 'TextField',
      defaultProp: 'defaultValue',
      deserilizeFunction: '',
      validation: '{{ required: true }}',
      displayFunction: undefined,
      listDisplayFunction: 'truncate',
      dataType: undefined,
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
      dataType:
        componentMetadata[column.type]?.dataType ||
        componentMetadata.default.dataType,
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

  const scaffoldPathCamel = formatCamelPath(scaffoldPath)

  const pluralCamelName = camelcase(pluralName)
  const camelScaffoldPath = camelcase(pascalcase(scaffoldPath))

  const pluralRouteName =
    scaffoldPath === '' ? pluralCamelName : `${camelScaffoldPath}${pluralName}`

  const editRouteName =
    scaffoldPath === ''
      ? `edit${singularName}`
      : `${camelScaffoldPath}Edit${singularName}`

  const singularRouteName =
    scaffoldPath === ''
      ? camelcase(singularName)
      : `${camelScaffoldPath}${singularName}`

  const newRouteName =
    scaffoldPath === ''
      ? `new${singularName}`
      : `${camelScaffoldPath}New${singularName}`

  await asyncForEach(COMPONENTS, (component) => {
    const outputComponentName = component
      .replace(/Names/, pluralName)
      .replace(/Name/, singularName)
      .replace(/\.js\.template/, generateTypescript ? '.tsx' : '.js')

    const outputPath = path.join(
      getPaths().web.components,
      scaffoldPathCamel,
      outputComponentName.replace(/\.(js|tsx?)/, ''),
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
        scaffoldPathCamel,
        pluralRouteName,
        editRouteName,
        singularRouteName,
        newRouteName,
      }
    )
    fileList[outputPath] = template
  })

  return fileList
}

// add routes for all pages
export const routes = async ({ model: name, path: scaffoldPath = '' }) => {
  const singularPascalName = pascalcase(pluralize.singular(name))
  const pluralPascalName = pascalcase(pluralize(name))
  const singularCamelName = camelcase(singularPascalName)
  const pluralCamelName = camelcase(pluralPascalName)
  const pluralParamName = paramCase(pluralPascalName)
  const model = await getSchema(singularPascalName)
  const idRouteParam = getIdType(model) === 'Int' ? ':Int' : ''

  const paramScaffoldPath = formatParamPath(scaffoldPath)
  const pascalScaffoldPath = pascalcase(scaffoldPath)
  const camelScaffoldPath = camelcase(pascalScaffoldPath)

  const newRouteName =
    scaffoldPath === ''
      ? `new${singularPascalName}`
      : `${camelScaffoldPath}New${singularPascalName}`

  const editRouteName =
    scaffoldPath === ''
      ? `edit${singularPascalName}`
      : `${camelScaffoldPath}Edit${singularPascalName}`

  const singularRouteName =
    scaffoldPath === ''
      ? singularCamelName
      : `${camelScaffoldPath}${singularPascalName}`

  const pluralRouteName =
    scaffoldPath === ''
      ? pluralCamelName
      : `${camelScaffoldPath}${pluralPascalName}`

  // TODO: These names look like they need changing

  return [
    // new
    `<Route path="/${paramScaffoldPath}${pluralParamName}/new" page={${pascalScaffoldPath}New${singularPascalName}Page} name="${newRouteName}" />`,
    // edit
    `<Route path="/${paramScaffoldPath}${pluralParamName}/{id${idRouteParam}}/edit" page={${pascalScaffoldPath}Edit${singularPascalName}Page} name="${editRouteName}" />`,
    // singular
    `<Route path="/${paramScaffoldPath}${pluralParamName}/{id${idRouteParam}}" page={${pascalScaffoldPath}${singularPascalName}Page} name="${singularRouteName}" />`,
    // plural
    `<Route path="/${paramScaffoldPath}${pluralParamName}" page={${pascalScaffoldPath}${pluralPascalName}Page} name="${pluralRouteName}" />`,
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
    `'@redwoodjs/router'$1${importLayout}$1`
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
  const { name, path } = splitPathAndName(modelArg)

  const t = tasks({ model: name, path, force, typescript })

  try {
    await t.run()
  } catch (e) {
    console.log(c.error(e.message))
  }
}
