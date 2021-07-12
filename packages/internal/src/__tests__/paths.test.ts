import path from 'path'

import { processPagesDir, resolveFile, ensurePosixPath } from '../paths'

describe('paths', () => {
  describe('processPagesDir', () => {
    const FIXTURE_PATH = path.resolve(
      __dirname,
      '../../../../__fixtures__/example-todo-main'
    )

    beforeAll(() => {
      process.env.RWJS_CWD = FIXTURE_PATH
    })
    afterAll(() => {
      delete process.env.RWJS_CWD
    })

    it('it accurately finds and names the pages', () => {
      const pages = processPagesDir()

      expect(pages.length).toEqual(7)

      const adminEditUserPage = pages.find(
        (page) => page.importName === 'adminEditUserPage'
      )
      expect(adminEditUserPage).not.toBeUndefined()
      expect(adminEditUserPage.importPath).toEqual(
        './pages/admin/EditUserPage/EditUserPage'
      )

      const barPage = pages.find((page) => page.importName === 'BarPage')
      expect(barPage).not.toBeUndefined()
      expect(barPage.importPath).toEqual('./pages/BarPage/BarPage')

      const fatalErrorPage = pages.find(
        (page) => page.importName === 'FatalErrorPage'
      )
      expect(fatalErrorPage).not.toBeUndefined()
      expect(fatalErrorPage.importPath).toEqual(
        './pages/FatalErrorPage/FatalErrorPage'
      )

      const fooPage = pages.find((page) => page.importName === 'FooPage')
      expect(fooPage).not.toBeUndefined()
      expect(fooPage.importPath).toEqual('./pages/FooPage/FooPage')

      const homePage = pages.find((page) => page.importName === 'HomePage')
      expect(homePage).not.toBeUndefined()
      expect(homePage.importPath).toEqual('./pages/HomePage/HomePage')

      const notFoundPage = pages.find(
        (page) => page.importName === 'NotFoundPage'
      )
      expect(notFoundPage).not.toBeUndefined()
      expect(notFoundPage.importPath).toEqual(
        './pages/NotFoundPage/NotFoundPage'
      )

      const typeScriptPage = pages.find(
        (page) => page.importName === 'TypeScriptPage'
      )
      expect(typeScriptPage).not.toBeUndefined()
      expect(typeScriptPage.importPath).toEqual(
        './pages/TypeScriptPage/TypeScriptPage'
      )
    })
  })

  describe('resolveFile', () => {
    const p = resolveFile(path.join(__dirname, './fixtures/api/test/test'))
    expect(path.extname(p)).toEqual('.ts')
  })

  describe('ensurePosixPath', () => {
    it('Returns unmodified input if not on Windows', () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'NotWindows',
      })

      const testPath = 'X:\\some\\weird\\path'
      const posixPath = ensurePosixPath(testPath)

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
      })

      expect(posixPath).toEqual(testPath)
    })

    it('Transforms paths on Windows', () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      })

      const testPath = '..\\some\\relative\\path'
      const posixPath = ensurePosixPath(testPath)

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
      })

      expect(posixPath).toEqual('../some/relative/path')
    })

    it('Handles drive letters', () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      })

      const testPath = 'C:\\some\\full\\path\\to\\file.ext'
      const posixPath = ensurePosixPath(testPath)

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
      })

      expect(posixPath).toEqual('/c/some/full/path/to/file.ext')
    })
  })
})
