import path from 'path'

import type { PluginObj, types } from '@babel/core'

export default function (
  { types: t }: { types: typeof types },
  options: {
    /** absolute path to the `src` directory */
    srcAbsPath: string
  }
): PluginObj {
  return {
    name: 'babel-plugin-redwood-src-alias',
    visitor: {
      ImportDeclaration(p, state) {
        const { value } = p.node.source // import xyz from <value>
        const { filename } = state.file.opts // the file where this import statement resides

        // We only operate in "userland" so skip node_modules.
        // Skip everything that's not a 'src/' alias import.
        if (
          !filename ||
          filename?.includes('/node_modules/') ||
          !value.startsWith('src/')
        ) {
          return
        }

        // remove `src/` and create an absolute path
        const absPath = path.join(options.srcAbsPath, value.substr(4))
        let newImport = path.relative(path.dirname(filename), absPath)
        if (newImport.indexOf('.') !== 0) {
          newImport = './' + newImport
        }
        const newSource = t.stringLiteral(newImport)

        p.node.source = newSource
      },

      ExportDeclaration(p, state) {
        // @ts-expect-error `source` does exist
        if (!p?.node?.source) {
          return
        }

        // @ts-expect-error `source` does exist
        const { value } = p.node.source
        const { filename } = state.file.opts

        if (
          !filename ||
          filename?.includes('/node_modules/') ||
          !value.startsWith('src/')
        ) {
          return
        }

        // remove `src/` and create an absolute path
        const absPath = path.join(options.srcAbsPath, value.substr(4))
        const newImport = path.relative(path.dirname(filename), absPath)
        const newSource = t.stringLiteral(newImport)
        // @ts-expect-error `source` does exist
        p.node.source = newSource
      },
    },
  }
}
