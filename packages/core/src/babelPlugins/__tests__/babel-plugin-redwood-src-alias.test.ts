import path from 'path'

import * as babel from '@babel/core'

import redwoodSrcAlias from '../babel-plugin-redwood-src-alias'

const transpile = (code: string) => {
  const result = babel.transform(code, {
    babelrc: false,
    filename: path.resolve(
      './__tests__/__fixtures__/src-alias/pages/HomePage/HomePage.js'
    ), // ordinarily provided by babel itself, but we fake it for the tests.
    plugins: [
      [
        redwoodSrcAlias,
        {
          // This would usually be `web` or `api` src directory.
          srcAbsPath: path.resolve('./__tests__/__fixtures__/src-alias/'),
        },
      ],
    ],
  })

  return result?.code
}

test('importing and exporting from `src` alias works', () => {
  // imports
  expect(transpile(`import { Toolbar } from "src/components/Toolbar"`)).toEqual(
    `import { Toolbar } from "../../components/Toolbar";`
  )
  expect(transpile(`import DEFAULT from "src/components/Toolbar"`)).toEqual(
    `import DEFAULT from "../../components/Toolbar";`
  )

  // exports
  expect(transpile(`export { Toolbar } from "src/components/Toolbar"`)).toEqual(
    `export { Toolbar } from "../../components/Toolbar";`
  )
})
