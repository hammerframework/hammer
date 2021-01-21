import { basename, dirname, extname, join } from 'path'

import { readdirSync } from 'fs-extra'
import * as tsm from 'ts-morph'
import { TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  CodeLens,
  DocumentLink,
  DocumentUri,
  Hover,
  Location,
  Range,
} from 'vscode-languageserver-types'

import { DefaultHost, Host } from './hosts'
import { OutlineInfoProvider } from './model/types'
import {
  ArrayLike,
  ArrayLike_normalize,
  Array_collectInstancesOf,
  iter,
} from './x/Array'
import { lazy, memo } from './x/decorators'
import { basenameNoExt, followsDirNameConvention } from './x/path'
import { createTSMSourceFile_cached } from './x/ts-morph'
import { tsm_Project_redwoodFriendly } from './x/ts-morph2/tsm_Project_redwoodFriendly'
import { ts_findTSOrJSConfig } from './x/ts/ts_findTSConfig'
import { URL_file } from './x/URL'
import { ExtendedDiagnostic } from './x/vscode-languageserver-types'

export type NodeID = string

export type IDEInfo =
  | Definition
  | Implementation
  | Reference
  | CodeLensX
  | HoverX
  | Decoration
  | DocumentLinkX

export interface Definition {
  kind: 'Definition'
  location: Location
  target: Location
}

export interface Implementation {
  kind: 'Implementation'
  location: Location
  target: Location
}

export interface Reference {
  kind: 'Reference'
  location: Location
  target: Location
}

export interface CodeLensX {
  kind: 'CodeLens'
  location: Location
  codeLens: CodeLens
}

export interface HoverX {
  kind: 'Hover'
  location: Location
  hover: Hover
}

export interface Decoration {
  kind: 'Decoration'
  location: Location
  style:
    | 'path_punctuation'
    | 'path_parameter'
    | 'path_slash'
    | 'path_parameter_type'
}

export interface DocumentLinkX {
  kind: 'DocumentLink'
  location: Location
  link: DocumentLink
}

export abstract class BaseNode implements OutlineInfoProvider {
  /**
   * Each node MUST have a unique ID.
   * IDs have meaningful information.
   *
   * examples:
   * - /path/to/project
   * - /path/to/project/web/src/Routes.js
   * - /path/to/project/web/src/Routes.js /route1
   */
  abstract get id(): NodeID
  abstract get parent(): BaseNode | undefined

  @lazy()
  get host(): Host {
    if (this.parent) return this.parent.host
    throw new Error(
      "Could not find host implementation on root node (you must override the 'host' getter)"
    )
  }
  exists = true
  /**
   * Returns the children of this node.
   * Override this.
   */
  children(): ArrayLike<BaseNode | undefined | null> {
    return []
  }
  @memo() private async _children() {
    return (await ArrayLike_normalize(this.children()))
      .filter((x) => !!x)
      .map((x) => x as BaseNode)
  }

  /**
   * Diagnostics for this node (must not include children's diagnostics).
   * Override this.
   */
  diagnostics(): ArrayLike<ExtendedDiagnostic> {
    return []
  }
  @memo() private _diagnostics() {
    return ArrayLike_normalize(this.diagnostics())
  }

  /**
   * IDE info for this node.
   * Override this.
   */
  ideInfo(): ArrayLike<IDEInfo> {
    return []
  }
  @memo() private _ideInfo() {
    return ArrayLike_normalize(this.ideInfo())
  }

  @memo(JSON.stringify)
  async collectIDEInfo(uri?: string): Promise<IDEInfo[]> {
    if (uri && this.bailOutOnCollection(uri)) return []
    try {
      const d1 = await this._ideInfo()
      const dd = await Promise.all(
        (await this._children()).map((c) => c.collectIDEInfo(uri))
      )
      const d2 = dd.flat()
      let all = [...d1, ...d2]
      if (uri) all = all.filter((x) => x.location.uri === uri)
      return all
    } catch (e) {
      // TODO: this diagnostic is also interesting
      console.log(e)
      return []
    }
  }

  /**
   * Collects diagnostics for this node and all descendants.
   * This is what you'll use to gather all the project diagnostics.
   */
  @memo(JSON.stringify)
  async collectDiagnostics(uri?: string): Promise<ExtendedDiagnostic[]> {
    // TODO: catch runtime errors and add them as diagnostics
    // TODO: we can parallelize this further
    if (uri && this.bailOutOnCollection(uri)) return []
    try {
      const d1 = await this._diagnostics()
      const dd = await Promise.all(
        (await this._children()).map((c) => c.collectDiagnostics(uri))
      )
      const d2 = dd.flat()
      let all = [...d1, ...d2]
      if (uri) all = all.filter((x) => x.uri === uri)
      return all
    } catch (e) {
      const uri = this.closestContainingUri
      if (!uri) throw e
      const range = Range.create(0, 0, 0, 0)
      return [
        {
          uri,
          diagnostic: { message: e + '', range },
        },
      ]
    }
  }

  bailOutOnCollection(uri: string): boolean {
    if (typeof uri !== 'string') return true
    if (this.id === uri) return false
    if (uri.startsWith(this.id)) return false
    return true
  }

  @lazy() get closestContainingUri(): string | undefined {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { uri } = this as any
      if (uri) return uri
    } catch (e) {
      /* */
    }
    if (this.parent) return this.parent.closestContainingUri
    return undefined
  }

  /**
   * Finds a node by ID.
   * The default algorithm tries to be economic and only create the necessary
   * intermediate nodes.
   * Subclasses can override this to add further optimizations.
   * @param id
   */
  @memo()
  async findNode(id: NodeID): Promise<BaseNode | undefined> {
    id = URL_file(id)
    if (this.id === id) return this
    if (id.startsWith(this.id))
      for (const c of await this._children()) {
        // depth first search by default
        const cc = await c.findNode(id)
        if (cc) return cc
      }
    return undefined
  }

  @lazy() get root(): BaseNode {
    return this.parent ? this.parent.root : this
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @lazy() get rootCache(): Map<any, any> {
    if (this.parent) return this.parent.rootCache
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Map<any, any>()
  }
}

export abstract class FileNode extends BaseNode {
  abstract get filePath(): string
  @lazy() get uri(): DocumentUri {
    return URL_file(this.filePath)
  }
  /**
   * the ID of a FileNode is its file:// uri.
   */
  @lazy() get id() {
    return this.uri
  }
  @lazy() get text() {
    return this.host.readFileSync(this.filePath)
  }
  @lazy() get fileExists(): boolean {
    return this.host.existsSync(this.filePath)
  }
  /**
   * parsed ts-morph source file.
   * this file is cheap to create since it doesn't trigger the processing of any other file in the project
   * it has no knowledge of related source files, but it does contain the internal structure of the file
   */
  @lazy() get sf(): tsm.SourceFile {
    if (!this.hasJSLikeExtension)
      throw new Error(
        'cannot create ts-morph source file for this type of file ' +
          this.filePath
      )
    if (typeof this.text === 'undefined')
      throw new Error('undefined file ' + this.filePath)
    return createTSMSourceFile_cached(this.filePath, this.text!)
  }

  @lazy() get hasJSLikeExtension(): boolean {
    return ['.js', '.jsx', 'ts', '.tsx'].includes(extname(this.filePath))
  }

  /**
   * parsed ts-morph source file.
   * this is *very expensive* to create since it needs to build the containing project.
   * prefer this.sf whenever possible.
   */
  @lazy() get sf_withReferences(): tsm.SourceFile | undefined {
    if (!this.hasJSLikeExtension)
      throw new Error(
        'cannot create ts-morph source file for this type of file ' +
          this.filePath
      )
    return this.tsm_Project?.getSourceFile(this.filePath)
  }

  @lazy() get basenameNoExt() {
    return basenameNoExt(this.filePath)
  }

  @lazy() get basename() {
    return basename(this.filePath)
  }

  @lazy() private get tsm_Project(): tsm.Project | undefined {
    const tsconfig = ts_findTSOrJSConfig(this.filePath)
    if (!tsconfig) return undefined
    const cache = this.rootCache
    const key = 'ts morph for ' + tsconfig
    if (cache.has(key)) return cache.get(key)
    const p = tsm_Project_redwoodFriendly(tsconfig, true)
    cache.set(key, p)
    return p
  }

  /**
   * Uses a project-wide ts-morph Project and calls sf.getReferencedSourceFiles().
   * It then maps each file to obtain the corresponding FileNodes
   */
  @memo() async allReferencedNodes() {
    const ff = this.sf_withReferences
      ?.getReferencedSourceFiles()
      ?.map((x) => this.root.findNode(x.getFilePath()))
    if (!ff) return []
    const ff2 = await Promise.all(ff)
    return Array_collectInstancesOf(FileNode, ff2)
  }

  /**
   * if file follows dirname convention, then this returns
   * all files in the same dir (mocks, stories, tests, etc)
   *
   * for example, for file
   * src/layouts/MyLayout/MyLayout.js
   *
   * it returns
   * src/layouts/MyLayout/MyLayout.mock.js
   * src/layouts/MyLayout/MyLayout.stories.js
   */
  @lazy() get relatedArtifacts(): DocumentUri[] {
    // make sure this is a URI
    const { filePath, uri } = this
    return iter(function* () {
      // if this file follows the dirname convention
      const fdc = followsDirNameConvention(filePath)
      if (fdc) {
        // get all files in the same dir
        const dir = dirname(filePath)
        for (const dd of readdirSync(dir)) {
          const file2 = join(dir, dd)
          const file2URI = URL_file(file2)
          if (file2URI === uri) continue // do not list same file
          yield file2URI
        }
      }
    })
  }

  @lazy() get followsDirNameConvention(): boolean {
    return followsDirNameConvention(this.filePath)
  }

  /**
   * creates the standard name for artifact (if possible)
   * @param artifactType
   */
  @memo() private composeStandardArtifactFilePath(
    artifactType: 'test' | 'stories' | 'mock'
  ): string | undefined {
    if (this.followsDirNameConvention) {
      const parts = this.filePath.split('.')
      parts.push(artifactType, parts.pop()!)
      return parts.join('.')
    }
  }

  protected getArtifactChildren(opts?: SpecialArtifactTypeOpts) {
    const standard = this.getStandardArtifactOutlineChildren(opts)
    const all = this.relatedArtifacts
    // remove from 'all' the ones that are already listed as standard (to prevent duplicates)
    const all2 = all.filter((uri) => !standard.some((e) => e?.uri === uri))
    const all3 = all2.map((uri) => ({ uri }))
    return [...standard, ...all3]
  }

  private getStandardArtifactOutlineChildren(opts?: SpecialArtifactTypeOpts) {
    if (!this.hasJSLikeExtension) return []
    const self = this
    const res = [
      opts?.test ? artifact('test', 'unit test') : undefined,
      opts?.mock ? artifact('mock', 'data mock') : undefined,
      opts?.stories ? artifact('stories', 'storybook stories') : undefined,
    ]
    return res.sort((a, b) => sortv(a) - sortv(b))
    function sortv(x) {
      return x?.uri ? 0 : 1
    }
    function artifact(
      artifactType: 'test' | 'stories' | 'mock',
      description: string
    ) {
      const test_ = self.composeStandardArtifactFilePath(artifactType)
      if (test_) {
        if (self.host.existsSync(test_)) {
          return {
            uri: URL_file(test_),
            outlineDescription: description,
          } as OutlineInfoProvider
        } else {
          const bn = basename(test_)
          return {
            key: 'create artifact ' + artifactType,
            outlineLabel: '',
            outlineDescription: `${bn} (click to create)`,
            outlineTooltip: 'click to create file',
          } as OutlineInfoProvider
        }
      }
    }
  }
}

interface SpecialArtifactTypeOpts {
  test?: boolean
  mock?: boolean
  stories?: boolean
}

export class HostWithDocumentsStore implements Host {
  defaultHost = new DefaultHost()
  constructor(public documents: TextDocuments<TextDocument>) {}
  readFileSync(path: string) {
    const uri = URL_file(path)
    const doc = this.documents.get(uri)
    if (doc) return doc.getText()
    return this.defaultHost.readFileSync(path)
  }
  existsSync(path: string) {
    return this.defaultHost.existsSync(path)
  }
  readdirSync(path: string) {
    return this.defaultHost.readdirSync(path)
  }
  globSync(pattern: string) {
    return this.defaultHost.globSync(pattern)
  }
  writeFileSync(path: string, contents: string) {
    return this.defaultHost.writeFileSync(path, contents)
  }
  get paths() {
    return this.defaultHost.paths
  }
}
