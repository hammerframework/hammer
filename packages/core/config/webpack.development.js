// const ErrorOverlayPlugin = require('error-overlay-webpack-plugin')
const escapeRegExp = require('lodash.escaperegexp')
const { merge } = require('webpack-merge')

const { getConfig } = require('@redwoodjs/internal')

const webpackConfig = require('./webpack.common')

const { mergeUserWebpackConfig } = webpackConfig
const redwoodConfig = getConfig()

const baseConfig = merge(webpackConfig('development'), {
  devServer: {
    // https://webpack.js.org/configuration/dev-server/
    // note: docs not yet updated for webpack-dev-server v4
    devMiddleware: {
      writeToDisk: false,
    },
    compress: true,
    historyApiFallback: true,
    host: redwoodConfig.web.host || 'localhost',
    port: redwoodConfig.web.port,
    proxy: {
      [redwoodConfig.web.apiProxyPath]: {
        target: `http://[::1]:${redwoodConfig.api.port}`,
        pathRewrite: {
          [`^${escapeRegExp(redwoodConfig.web.apiProxyPath)}`]: '',
        },
        headers: {
          Connection: 'keep-alive',
        },
      },
    },
    open: redwoodConfig.browser.open,
  },
  watchOptions: {
    ignored: ['**/*.d.ts'],
  },
  optimization: {
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false,
  },
  infrastructureLogging: {
    level: 'error', // new in v4; previously we used quiet
  },
  // plugins: [new ErrorOverlayPlugin()].filter(Boolean),
  // plugin does not yet work with Webpack 5: https://github.com/smooth-code/error-overlay-webpack-plugin/issues/67
  // webpack-dev-server v4 enables an overlay by default, it's just not as pretty
})

/** @type {import('webpack').Configuration} */
module.exports = mergeUserWebpackConfig('development', baseConfig)
