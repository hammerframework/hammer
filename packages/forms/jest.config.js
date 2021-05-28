/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  moduleNameMapper: {
    /**
     * Not entirely sure what's changed in Jest that, or react-hook-form,
     * that now requires this.
     */
    'react-hook-form':
      '<rootDir>/../../node_modules/react-hook-form/dist/index.cjs',
  },
}
