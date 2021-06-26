const fs = require('fs')
const path = require('path')

const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const Dotenv = require('dotenv-webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const webpack = require('webpack')
const { WebpackManifestPlugin } = require('webpack-manifest-plugin')
const { merge } = require('webpack-merge')
const { RetryChunkLoadPlugin } = require('webpack-retry-chunk-load-plugin')

const { getConfig, getPaths } = require('@redwoodjs/internal')

const redwoodConfig = getConfig()
const redwoodPaths = getPaths()

/** @returns {{[key: string]: string}} Env vars */
const getEnvVars = () => {
  const redwoodEnvPrefix = 'REDWOOD_ENV_'
  const includeEnvKeys = redwoodConfig.web.includeEnvironmentVariables
  const redwoodEnvKeys = Object.keys(process.env).reduce((prev, next) => {
    if (
      next.startsWith(redwoodEnvPrefix) ||
      (includeEnvKeys && includeEnvKeys.includes(next))
    ) {
      prev[`process.env.${next}`] = JSON.stringify(process.env[next])
    }
    return prev
  }, {})

  return redwoodEnvKeys
}

/** @returns {import('webpack').RuleSetLoader[]} */
const getStyleLoaders = (isEnvProduction) => {
  const styleOrExtractLoader = isEnvProduction
    ? MiniCssExtractPlugin.loader
    : 'style-loader'

  const cssLoader = (withModules, importLoaders) => {
    // Obscured classnames in production, more expressive classnames in development.
    const localIdentName = isEnvProduction
      ? '[contenthash:base64]'
      : '[path][name]__[local]--[contenthash:base64:5]'

    const loaderConfig = {
      loader: 'css-loader',
      options: {
        sourceMap: !isEnvProduction,
        importLoaders,
      },
    }

    // Enables CSS modules
    if (withModules) {
      loaderConfig.options.modules = { localIdentName }
    }

    return loaderConfig
  }

  const paths = getPaths()
  const hasPostCssConfig = fs.existsSync(paths.web.postcss)

  // We only use the postcss-loader if there is a postcss config file
  // at web/config/postcss.config.js
  const postCssLoader = hasPostCssConfig
    ? {
        loader: 'postcss-loader',
        options: {
          postcssOptions: {
            config: paths.web.postcss,
          },
        },
      }
    : null

  const numImportLoadersForCSS = hasPostCssConfig ? 1 : 0
  const numImportLoadersForSCSS = hasPostCssConfig ? 2 : 1

  return [
    {
      test: /\.module\.css$/,
      use: [
        styleOrExtractLoader,
        cssLoader(true, numImportLoadersForCSS),
        postCssLoader,
      ].filter(Boolean),
    },
    {
      test: /\.css$/,
      use: [
        styleOrExtractLoader,
        cssLoader(false, numImportLoadersForCSS),
        postCssLoader,
      ].filter(Boolean),
      sideEffects: true,
    },
    {
      test: /\.module\.scss$/,
      use: [
        styleOrExtractLoader,
        cssLoader(true, numImportLoadersForSCSS),
        postCssLoader,
        'sass-loader',
      ].filter(Boolean),
    },
    {
      test: /\.scss$/,
      use: [
        styleOrExtractLoader,
        cssLoader(false, numImportLoadersForSCSS),
        postCssLoader,
        'sass-loader',
      ].filter(Boolean),
      sideEffects: true,
    },
  ]
}

/** @returns {import('webpack').Plugin[]} Plugins shared with storybook, as well as the RW app */
const getSharedPlugins = (isEnvProduction) => {
  const shouldIncludeFastRefresh =
    redwoodConfig.web.fastRefresh !== false && !isEnvProduction

  return [
    isEnvProduction &&
      new MiniCssExtractPlugin({
        filename: 'static/css/[name].[contenthash:8].css',
        chunkFilename: 'static/css/[name].[contenthash:8].css',
      }),
    shouldIncludeFastRefresh &&
      // 06-2021 bug with Webpack v5 and sockjs-client dependency conflict
      // https://github.com/pmmmwh/react-refresh-webpack-plugin/issues/396
      new ReactRefreshWebpackPlugin({ overlay: false }),
    new webpack.ProvidePlugin({
      React: 'react',
      PropTypes: 'prop-types',
      gql: 'graphql-tag',
      mockGraphQLQuery: ['@redwoodjs/testing', 'mockGraphQLQuery'],
      mockGraphQLMutation: ['@redwoodjs/testing', 'mockGraphQLMutation'],
      mockCurrentUser: ['@redwoodjs/testing', 'mockCurrentUser'],
    }),
    // The define plugin will replace these keys with their values during build
    // time.
    new webpack.DefinePlugin({
      __REDWOOD__API_PROXY_PATH: JSON.stringify(redwoodConfig.web.apiProxyPath),
      ...getEnvVars(),
    }),
    new Dotenv({
      path: path.resolve(redwoodPaths.base, '.env'),
      silent: true,
    }),
  ].filter(Boolean)
}

// I've borrowed and learnt extensively from the `create-react-app` repo:
// https://github.com/facebook/create-react-app/blob/master/packages/react-scripts/config/webpack.config.js
module.exports = (webpackEnv) => {
  const isEnvProduction = webpackEnv === 'production'

  const shouldIncludeFastRefresh =
    redwoodConfig.web.experimentalFastRefresh && !isEnvProduction

  const shouldUseEsbuild = process.env.ESBUILD === '1'

  return {
    mode: isEnvProduction ? 'production' : 'development',
    devtool: isEnvProduction ? 'source-map' : 'cheap-module-source-map',
    entry: {
      /**
       * Prerender requires a top-level component.
       * Before we had `ReactDOM` and a top-level component in the same file (web/index.js).
       * If index.js is defined in the user's project, use that, if not
       * use the one provided in web/dist/entry/index.js
       */
      app:
        redwoodPaths.web.index ||
        require.resolve('@redwoodjs/web/dist/entry/index.js'),
    },
    resolve: {
      extensions: ['.wasm', '.mjs', '.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        // https://www.styled-components.com/docs/faqs#duplicated-module-in-node_modules
        'styled-components': path.resolve(
          redwoodPaths.base,
          'node_modules',
          'styled-components'
        ),
        '~redwood-app-root': path.resolve(redwoodPaths.web.app),
        react: path.resolve(redwoodPaths.base, 'node_modules', 'react'),
      },
    },
    plugins: [
      !isEnvProduction && new webpack.HotModuleReplacementPlugin(),
      new HtmlWebpackPlugin({
        title: path.basename(redwoodPaths.base),
        template: path.resolve(redwoodPaths.base, 'web/src/index.html'),
        templateParameters: {
          prerenderPlaceholder: isEnvProduction
            ? '<server-markup></server-markup>'
            : '<!-- Prerender placeholder -->',
        },
        scriptLoading: 'defer',
        inject: true,
        chunks: 'all',
      }),
      new CopyPlugin({
        patterns: [
          {
            from: path.join(redwoodPaths.web.base, 'public'),
            to: '',
            globOptions: { ignore: ['README.md'] },
          },
        ],
      }),
      isEnvProduction &&
        new RetryChunkLoadPlugin({
          cacheBust: `function() {
					return Date.now();
				}`,
          maxRetries: 5,
          // @TODO: Add redirect to fatalErrorPage
          // lastResortScript: "window.location.href='/500.html';"
        }),
      isEnvProduction && new WebpackManifestPlugin(),
      ...getSharedPlugins(isEnvProduction),
    ].filter(Boolean),
    module: {
      rules: [
        // ** NOTE ** People usually overwrite these loaders via index,
        // so it's important to try and keep those indexes stable.
        {
          oneOf: [
            // (0)
            {
              test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
              use: [
                {
                  loader: 'url-loader',
                  options: {
                    limit: '10000',
                    name: 'static/media/[name].[contenthash:8].[ext]',
                  },
                },
              ],
            },
            // (1)
            {
              test: /\.(js|mjs|jsx)$/,
              exclude: /(node_modules)/,
              use: [
                {
                  loader: 'babel-loader',
                  options: {
                    cwd: redwoodPaths.base,
                    plugins: [
                      shouldIncludeFastRefresh &&
                        require.resolve('react-refresh/babel'),
                    ].filter(Boolean),
                  },
                },
                shouldUseEsbuild && {
                  loader: 'esbuild-loader',
                  options: {
                    loader: 'jsx',
                  },
                },
              ].filter(Boolean),
            },
            // (2)
            {
              test: /\.(ts|tsx)$/,
              exclude: /(node_modules)/,
              use: [
                {
                  loader: 'babel-loader',
                  options: {
                    cwd: redwoodPaths.base,
                    plugins: [
                      shouldIncludeFastRefresh &&
                        require.resolve('react-refresh/babel'),
                    ].filter(Boolean),
                  },
                },
                shouldUseEsbuild && {
                  loader: 'esbuild-loader',
                  options: {
                    loader: 'tsx',
                  },
                },
              ].filter(Boolean),
            },
            // .module.css (3), .css (4), .module.scss (5), .scss (6)
            ...getStyleLoaders(isEnvProduction),
            // (7)
            isEnvProduction && {
              test: require.resolve('@redwoodjs/router/dist/splash-page'),
              use: 'null-loader',
            },
            // (8)
            {
              test: /\.(svg|ico|jpg|jpeg|png|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/,
              loader: 'file-loader',
              options: {
                name: 'static/media/[name].[contenthash:8].[ext]',
              },
            },
          ].filter(Boolean),
        },
      ],
    },
    optimization: {
      mergeDuplicateChunks: true,
      splitChunks: {
        chunks: 'all',
        minChunks: 2,
      },
      runtimeChunk: {
        name: (entrypoint) => `runtime-${entrypoint.name}`,
      },
      // This doesn't get used when mode !== 'production'
      // Because minimize gets set to false, see https://webpack.js.org/configuration/mode/#usage
      minimizer: [new CssMinimizerPlugin(), '...'],
    },
    output: {
      pathinfo: true,
      filename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].js'
        : 'static/js/[name].bundle.js',
      chunkFilename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].chunk.js'
        : 'static/js/[name].chunk.js',
      path: path.resolve(redwoodPaths.base, 'web/dist'),
      publicPath: '/',
      devtoolModuleFilenameTemplate: isEnvProduction
        ? (info) =>
            path
              .relative(redwoodPaths.web.src, info.absoluteResourcePath)
              .replace(/\\/g, '/')
        : (info) => path.resolve(info.absoluteResourcePath).replace(/\\/g, '/'),
    },
  }
}

/** @returns {import('webpack').Configuration} */
module.exports.mergeUserWebpackConfig = (mode, baseConfig) => {
  const redwoodPaths = getPaths()
  const hasCustomConfig = fs.existsSync(redwoodPaths.web.webpack)
  if (!hasCustomConfig) {
    return baseConfig
  }
  const userWebpackConfig = require(redwoodPaths.web.webpack)

  if (typeof userWebpackConfig === 'function') {
    return userWebpackConfig(baseConfig, { mode })
  }

  return merge(baseConfig, userWebpackConfig)
}

module.exports.getEnvVars = getEnvVars
module.exports.getSharedPlugins = getSharedPlugins
module.exports.getStyleLoaders = getStyleLoaders
