const fs = require('fs')
const path = require('path')
const { merge } = require('webpack-merge')
const { getConfig, getPaths } = require('@redwoodjs/internal')
const { getSharedPlugins } = require('../webpack.common')

const config = getConfig()

const baseConfig = {
  stories: ['../../../../web/src/**/*.stories.{tsx,jsx,js}'],
  addons: [
     config.web.a11y && '@storybook/addon-a11y'
  ].filter(Boolean),
  // https://storybook.js.org/blog/storybook-for-webpack-5/
  core: {
    builder: "webpack5",
  },
  webpackFinal: (sbConfig, { configType }) => {
    // configType is 'PRODUCTION' or 'DEVELOPMENT', why shout?
    const isEnvProduction = configType && configType.toLowerCase() === 'production'

    const rwConfig = isEnvProduction
      ? require('../webpack.production')
      : require('../webpack.development')

    // We replace imports to "@redwoodjs/router" with our own implementation in "@redwoodjs/testing"
    sbConfig.resolve.alias['@redwoodjs/router$'] = path.join(getPaths().base, 'node_modules/@redwoodjs/testing/dist/MockRouter.js')
    sbConfig.resolve.alias['~__REDWOOD__USER_ROUTES_FOR_MOCK'] = getPaths().web.routes
    sbConfig.resolve.alias['~__REDWOOD__USER_WEB_SRC'] = getPaths().web.src

    // Determine the default storybook style file to use.
    const supportedStyleIndexFiles = ['index.scss', 'index.sass', 'index.css']
    for (let file of supportedStyleIndexFiles) {
      const filePath = path.join(getPaths().web.src, file);
      if (fs.existsSync(filePath)) {
        sbConfig.resolve.alias['~__REDWOOD__USER_WEB_DEFAULT_CSS'] = filePath
        break;
      }
    }

    const userPreviewPath = fs.existsSync(getPaths().web.storybookPreviewConfig)
      ? getPaths().web.storybookPreviewConfig
      : './preview.example.js'
    sbConfig.resolve.alias['~__REDWOOD__USER_STORYBOOK_PREVIEW_CONFIG'] = userPreviewPath

    sbConfig.resolve.extensions = rwConfig.resolve.extensions
    sbConfig.resolve.plugins = rwConfig.resolve.plugins // Directory Named Plugin

    // ** PLUGINS **
    sbConfig.plugins = [
      ...sbConfig.plugins,
      ...getSharedPlugins(isEnvProduction),
    ]

    // ** LOADERS **
    sbConfig.module.rules = rwConfig.module.rules

    // ** NODE **
    sbConfig.node = rwConfig.node

    // Performance Improvements:
    // https://webpack.js.org/guides/build-performance/#avoid-extra-optimization-steps
    sbConfig.optimization = {
      removeAvailableModules: false,
      removeEmptyChunks: false,
      splitChunks: false,
    }
    // https://webpack.js.org/guides/build-performance/#output-without-path-info
    sbConfig.output.pathinfo = false

    return sbConfig
  },
}

const mergeUserStorybookConfig = (baseConfig) => {
  const redwoodPaths = getPaths()

  const hasCustomConfig = fs.existsSync(redwoodPaths.web.storybookConfig)
  if (!hasCustomConfig) {
    return baseConfig
  }

  const userStorybookConfig = require(redwoodPaths.web.storybookConfig)
  return merge(baseConfig, userStorybookConfig)
}

/** @returns {import('webpack').Configuration} Webpack Configuration with storybook config */
module.exports = mergeUserStorybookConfig(baseConfig)
