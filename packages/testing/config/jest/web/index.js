const path = require('path')

const { getPaths } = require('@redwoodjs/internal')

const rwjsPaths = getPaths()
const NODE_MODULES_PATH = path.join(rwjsPaths.base, 'node_modules')

module.exports = {
  displayName: {
    color: 'blueBright',
    name: 'web',
  },
  globals: {
    REDWOOD_API_URL: '',
    REDWOOD_API_GRAPHQL_SERVER_PATH: '/',
  },
  setupFilesAfterEnv: [path.resolve(__dirname, './jest.setup.js')],
  moduleNameMapper: {
    /**
     * Make sure modules that require different versions of these
     * dependencies end up using the same one.
     */
    '^react$': path.join(NODE_MODULES_PATH, 'react'),
    '^react-dom$': path.join(NODE_MODULES_PATH, 'react-dom'),
    '^@apollo/client/react$': path.join(
      NODE_MODULES_PATH,
      '@apollo/client/react'
    ),
    // We replace imports to "@redwoodjs/router" with our own "mock" implementation.
    '^@redwoodjs/router$': path.join(
      NODE_MODULES_PATH,
      '@redwoodjs/testing/dist/MockRouter.js'
    ),
    '^@redwoodjs/web$': path.join(NODE_MODULES_PATH, '@redwoodjs/web'),
    '^@redwoodjs/testing$': path.join(NODE_MODULES_PATH, '@redwoodjs/testing'),
    '~__REDWOOD__USER_ROUTES_FOR_MOCK': rwjsPaths.web.routes,
    /**
     * Mock out files that aren't particularly useful in tests. See fileMock.js for more info.
     */
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|css)$':
      '@redwoodjs/testing/dist/fileMock.js',
  },
}
