/* eslint-env node, commonjs */

const util = require('util')

const exec = util.promisify(require('child_process').exec)
const { getPaths } = require('@redwoodjs/internal')

module.exports.build = (
  { watch, rebuild } = { watch: false, rebuild: false }
) => {
  const ignoredFiles = [
    '**/*.test.js',
    '**/*.scenarios.js',
    '**/*.scenario.js',
    '**/*.test.ts',
    '**/*.scenarios.ts',
    '**/*.scenario.ts',
    '**/__tests__',
    '**/*.d.ts',
  ].join(',')

  return exec(
    [
      'yarn cross-env NODE_ENV=production babel src',
      '--out-dir dist',
      (!watch || !rebuild) && '--delete-dir-on-start',
      '--extensions .ts,.js',
      `--ignore ${ignoredFiles}`,
      '--source-maps true',
      watch && '--watch',
    ]
      .filter(Boolean)
      .join(' '),
    {
      cwd: getPaths().api.base,
    }
  )
}
