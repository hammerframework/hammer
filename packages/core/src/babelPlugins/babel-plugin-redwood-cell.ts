import type { PluginObj, types } from '@babel/core'

// This wraps a file that has a suffix of `Cell` in Redwood's `withCell` higher
// order component. The HOC deals with the lifecycle methods during a GraphQL query.
//
// ```js
// import { withCell } from '@redwoodjs/web'
// <YOUR CODE>
// export default withCell({ QUERY, Loading, Succes, Failure, Empty, beforeQuery, afterQuery })
// ```

// A cell can export the declarations below.
const EXPECTED_EXPORTS_FROM_CELL = [
  'beforeQuery',
  'beforeSubscription',
  'QUERY',
  'SUBSCRIPTION',
  'afterQuery',
  'afterSubscription',
  'Loading',
  'Success',
  'Failure',
  'Empty',
]

export default function ({ types: t }: { types: typeof types }): PluginObj {
  // This array will
  // - collect exports from the Cell file during ExportNamedDeclaration
  // - collected exports will then be passed to `withCell`
  // - be cleared after Program exit to prepare for the next file
  let exportNames: string[] = []
  let hasDefaultExport = false

  return {
    name: 'babel-plugin-redwood-cell',
    visitor: {
      ExportDefaultDeclaration() {
        hasDefaultExport = true
        return
      },
      ExportNamedDeclaration(path) {
        const declaration = path.node.declaration

        if (!declaration) {
          return
        }

        let name
        if (declaration.type === 'VariableDeclaration') {
          const id = declaration.declarations[0].id as types.Identifier
          name = id.name as string
        }
        if (declaration.type === 'FunctionDeclaration') {
          name = declaration?.id?.name
        }

        if (name && EXPECTED_EXPORTS_FROM_CELL.includes(name)) {
          exportNames.push(name)
        }
      },
      Program: {
        exit(path) {
          // Validate that this file has exports which are "cell-like":
          // If the user is not exporting `QUERY` or `SUBSCRIPTION` and has a default export then
          // it's likely not a cell.
          if (
            hasDefaultExport &&
            !exportNames.includes('QUERY') &&
            !exportNames.includes('SUBSCRIPTION')
          ) {
            return
          }

          // Insert at the top of the file:
          // + import { withCell } from '@redwoodjs/web'
          path.node.body.unshift(
            t.importDeclaration(
              [
                t.importSpecifier(
                  t.identifier('withCell'),
                  t.identifier('withCell')
                ),
              ],
              t.stringLiteral('@redwoodjs/web')
            )
          )

          // Insert at the bottom of the file:
          // + export default withCell({ QUERY?, Loading?, Succes?, Failure?, Empty?, beforeQuery?, afterQuery? })
          path.node.body.push(
            t.exportDefaultDeclaration(
              t.callExpression(t.identifier('withCell'), [
                t.objectExpression(
                  exportNames.map((name) =>
                    t.objectProperty(
                      t.identifier(name),
                      t.identifier(name),
                      false,
                      true
                    )
                  )
                ),
              ])
            )
          )

          hasDefaultExport = false
          exportNames = []
        },
      },
    },
  }
}
