import { existsSync } from 'fs'
import { basename, normalize, sep } from 'path'

export function directoryNameResolver(dirName: string): string | undefined {
  dirName = normalize(dirName)
  const parts = dirName.split(sep)
  const pp = parts[parts.length - 1]
  parts.push(pp)
  const extensions = ['.js', '.jsx', '.ts', '.tsx']
  const pathNoExt = parts.join(sep)
  for (const ext of extensions) {
    const path = pathNoExt + ext
    if (existsSync(path)) return path
  }
}

export function followsDirNameConvention(filePath: string): boolean {
  filePath = normalize(filePath)
  const ending = basenameNoExt(filePath) + sep + basename(filePath)
  return filePath.endsWith(ending)
}

/**
 * artifacts:  x.mock.js, x.test.js, x.stories.js
 * @param filePath
 */
export function isArtifact(filePath: string): boolean {
  const parts = basenameNoExt(filePath).split('.')
  if (parts.length === 1) return false
  const last = parts[parts.length - 1]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return artifactTypes.includes(last as any)
}

const artifactTypes = ['mock', 'test', 'stories'] as const

export function isNotArtifact(filePath: string): boolean {
  return !isArtifact(filePath)
}

export function isArtifactOfType(
  filePath: string,
  type: typeof artifactTypes[number]
): boolean {
  return basenameNoExt(filePath).endsWith(`.${type}`)
}

export function basenameNoExt(path: string): string {
  path = normalize(path)
  const parts = basename(path).split('.')
  if (parts.length > 1) parts.pop()
  return parts.join('.')
}

export function isLayoutFileName(f: string): boolean {
  f = normalize(f)
  return basenameNoExt(f).endsWith('Layout')
}

export function isCellFileName(f: string): boolean {
  f = normalize(f)
  return basenameNoExt(f).endsWith('Cell')
}
