const fs = require('fs')
const path = require('path')

const { merge } = require('webpack-merge')

const { getSharedPlugins } = require('@redwoodjs/core/config/webpack.common.js')
const { getConfig, getPaths } = require('@redwoodjs/internal')

const config = getConfig()

const rwjsPaths = getPaths()

const baseConfig = {
  stories: [`${rwjsPaths.web.src}/**/*.stories.{tsx,jsx,js}`],

  addons: [config.web.a11y && '@storybook/addon-a11y'].filter(Boolean),
  webpackFinal: (sbConfig, { configType }) => {
    // configType is 'PRODUCTION' or 'DEVELOPMENT', why shout?
    const isEnvProduction =
      configType && configType.toLowerCase() === 'production'

    const rwConfig = isEnvProduction
      ? require('@redwoodjs/core/config/webpack.production')
      : require('@redwoodjs/core/config/webpack.development')

    // We replace imports to "@redwoodjs/router" with our own implementation in "@redwoodjs/testing"
    sbConfig.resolve.alias['@redwoodjs/router$'] = require.resolve(
      '@redwoodjs/testing/dist/MockRouter.js'
    )
    sbConfig.resolve.alias['~__REDWOOD__USER_ROUTES_FOR_MOCK'] =
      rwjsPaths.web.routes
    sbConfig.resolve.alias['~__REDWOOD__USER_WEB_SRC'] = rwjsPaths.web.src

    // Determine the default storybook style file to use.
    const supportedStyleIndexFiles = ['index.scss', 'index.sass', 'index.css']
    for (let file of supportedStyleIndexFiles) {
      const filePath = path.join(rwjsPaths.web.src, file)
      if (fs.existsSync(filePath)) {
        sbConfig.resolve.alias['~__REDWOOD__USER_WEB_DEFAULT_CSS'] = filePath
        break
      }
    }

    const userPreviewPath = fs.existsSync(rwjsPaths.web.storybookPreviewConfig)
      ? rwjsPaths.web.storybookPreviewConfig
      : './preview.example.js'
    sbConfig.resolve.alias['~__REDWOOD__USER_STORYBOOK_PREVIEW_CONFIG'] =
      userPreviewPath

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
