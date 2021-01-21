/* eslint-disable @typescript-eslint/no-explicit-any */

// vscode is a compile-time only dependency
// we only use it in type declarations
// (we can't use "import type" since we need to do use it in some typeof expressions)
import { memoize } from 'lodash'
import * as vscode from 'vscode'
import { Connection as LSPConnection } from 'vscode-languageserver'
import { Command, Location } from 'vscode-languageserver-types'

import { lazy, memo } from '../x/decorators'

export type VSCodeWindowMethods = Pick<
  typeof vscode.window,
  'showInformationMessage' | 'showQuickPick' | 'showInputBox'
> & {
  createTerminal2(props: { name: string; cwd: string; cmd: string }): void
} & { withProgress(opts: any, task: () => void): void }

export function VSCodeWindowMethods_fromConnection(
  connection
): VSCodeWindowMethods {
  return new VSCodeWindowMethodsWrapper(connection)
}

/**
 * these methods are exposed by decoupled studio only
 */
class VSCodeWindowMethodsWrapper implements VSCodeWindowMethods {
  constructor(private connection: any) {}
  showQuickPick(...args: any[]) {
    return this.connection.sendRequest('xxx/showQuickPick', args)
  }
  showInformationMessage(...args: any[]) {
    return this.connection.sendRequest('xxx/showInformationMessage', args)
  }
  showInputBox(...args: any[]) {
    return this.connection.sendRequest('xxx/showInputBox', args)
  }
  createTerminal2(props: { name: string; cwd: string; cmd: string }): void {
    return this.connection.sendRequest('xxx/createTerminal2', [props])
  }
  withProgress(_options: any, task: () => void) {
    // TODO:
    return task()
  }
}

export type SerializableTreeItem = ReplacePropTypes<
  vscode.TreeItem,
  {
    resourceUri: string
    collapsibleState: TreeItemCollapsibleState2
    iconPath: ThemeIcon2
    command: Command
  }
> & {
  id: string
} & { menu?: TreeItemMenu }

/**
 * menus types must be known beforehand.
 * they are set up by the vscode extension in its package.json
 */
type TreeItemMenu = MenuCLI | MenuRoute | MenuGroup | MenuWithDoc

interface MenuCLI {
  kind: 'cli'
  doc?: Command
  run: Command
}

interface MenuRoute {
  kind: 'route'
  openInBrowser?: Command
  openComponent?: Command
  openRoute?: Command
}

interface MenuGroup {
  kind: 'group'
  add?: Command
  doc?: Command
}

interface MenuWithDoc {
  kind: 'withDoc'
  doc?: Command
}

/**
 * Based on the actual TreeItem interface provided by VSCode.
 * It has a few differences.
 */
export type TreeItem2 = Partial<SerializableTreeItem> & {
  key?: string
  children?(): vscode.ProviderResult<TreeItem2[]>
}

export class TreeItem2Wrapper {
  constructor(
    public item: TreeItem2,
    public parent?: TreeItem2Wrapper,
    public indexInParent: number = 0
  ) {}
  @lazy() get keys(): string[] {
    if (!this.parent) return []
    return [...(this.parent?.keys ?? []), this.key]
  }
  /**
   * They key of an item is
   * - if item.key is defined, then we use that value
   * - otherwise we "compose" a key made of item.label + indexInParent
   */
  @lazy() get key(): string {
    const {
      indexInParent,
      item: { key, label },
    } = this
    if (key) return key
    return (label ?? '') + '-' + indexInParent
  }
  @lazy() get id() {
    return JSON.stringify(this.keys)
  }
  @lazy() get collapsibleState() {
    return (
      this.item.collapsibleState ??
      (this.item.children
        ? TreeItemCollapsibleState2.Collapsed
        : TreeItemCollapsibleState2.None)
    )
  }
  @memo() async children(): Promise<TreeItem2Wrapper[]> {
    const cs = await ProviderResult_normalize(this.item.children?.())
    return (cs ?? []).map((c, i) => new TreeItem2Wrapper(c, this, i))
  }
  @memo()
  async findChild(key: string): Promise<TreeItem2Wrapper | undefined> {
    for (const c of await this.children()) if (c.key === key) return c
  }
  @memo(JSON.stringify)
  async findChildRec(keys: string[]): Promise<TreeItem2Wrapper | undefined> {
    if (keys.length === 0) return this
    const [k, ...rest] = keys
    return await (await this.findChild(k))?.findChildRec(rest)
  }
  @lazy() get serializableTreeItem(): SerializableTreeItem {
    return {
      ...this.item,
      id: this.id,
      collapsibleState: this.collapsibleState,
    }
  }
}

/**
 * https://microsoft.github.io/vscode-codicons/dist/codicon.html
 * plust a few extra icons provided by decoupled studio:
 * - redwood
 * - prisma
 * - graphql
 * - netlify
 */
type ThemeIcon2 = string

/**
 * A copy of vscode.TreeItemCollapsibleState
 * we don't want to have a runtime dependency on the vscode package
 */
export enum TreeItemCollapsibleState2 {
  /**
   * Determines an item can be neither collapsed nor expanded. Implies it has no children.
   */
  None = 0,
  /**
   * Determines an item is collapsed
   */
  Collapsed = 1,
  /**
   * Determines an item is expanded
   */
  Expanded = 2,
}

/**
 * A vscode.TreeDataProvider that uses string IDs as elements
 * and returns a SerializableTreeItem.
 */
type RemoteTreeDataProvider = ReplacePropTypes<
  vscode.TreeDataProvider<string>,
  {
    getTreeItem(id: string): Promise<SerializableTreeItem>
  }
>

export class RemoteTreeDataProviderImpl implements RemoteTreeDataProvider {
  constructor(
    private getRoot: () => Promise<TreeItem2>,
    private refreshInterval = 5000
  ) {}

  private root!: TreeItem2Wrapper

  private async refresh() {
    this.root = new TreeItem2Wrapper(await this.getRoot())
  }

  @memo()
  private async lazyInit() {
    await this.refresh()
    setInterval(async () => {
      await this.refresh()
      for (const l of this.listeners) l(undefined)
    }, this.refreshInterval)
  }

  // ----- start TreeDataProvider impl
  private listeners: Array<(e: string | undefined) => void> = []
  onDidChangeTreeData(listener: (e: string | undefined) => void) {
    this.lazyInit()
    this.listeners.push(listener)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return null as any // TODO: disposable (we're not using it for now)
  }

  async getTreeItem(id: string): Promise<SerializableTreeItem> {
    await this.lazyInit()
    //console.log('getTreeItem', id)
    const keys = JSON.parse(id)
    const item = await this.root.findChildRec(keys)
    if (!item) throw new Error(`item not found for id ${id}`)
    //console.log('--->', item.treeItemOverTheWire)
    return item.serializableTreeItem
  }

  async getChildren(id?: string): Promise<string[]> {
    await this.lazyInit()
    //console.log('getChildren', id)
    const keys = id ? JSON.parse(id) : []
    const self = await this.root.findChildRec(keys)
    const children = await self?.children()
    if (!children) return []
    const res = children?.map((c) => c.id)
    //console.log('--->', res)
    return res
  }

  //   getParent(id: string) {
  //     return null as any
  //   }

  // ----- end TreeDataProvider impl
}

export function RemoteTreeDataProvider_publishOverLSPConnection(
  tdp: RemoteTreeDataProvider,
  connection: LSPConnection,
  methodPrefix: string
) {
  const lazyInit = memoize(() => {
    // we only setup this listener if we receive a call
    tdp.onDidChangeTreeData?.((id) =>
      connection.sendRequest(`${methodPrefix}onDidChangeTreeData`, [id])
    )
  })
  connection.onRequest(`${methodPrefix}getChildren`, async (id) => {
    lazyInit()
    try {
      return await ProviderResult_normalize(tdp.getChildren(id))
    } catch (e) {
      return []
    }
  })
  connection.onRequest(`${methodPrefix}getTreeItem`, async (id) => {
    lazyInit()
    try {
      return await ProviderResult_normalize(tdp.getTreeItem(id))
    } catch (e) {
      return { label: '(project has too many errors)', tooltip: e + '' }
    }
  })
}

export async function ProviderResult_normalize<T>(
  x: vscode.ProviderResult<T>
): Promise<T | undefined> {
  if (isThenable(x)) return await ProviderResult_normalize(await x)
  if (x === null) return undefined
  return x
}

function isThenable(x: unknown): x is Thenable<unknown> {
  if (typeof x !== 'object') return false
  if (x === null) return false
  return typeof x['then'] === 'function'
}

export function Command_open(
  uriOrLocation: string | Location,
  title = 'open'
): Command {
  const { uri, range } = Location.is(uriOrLocation)
    ? uriOrLocation
    : { uri: uriOrLocation, range: undefined }
  if (uri.startsWith('https') || uri.startsWith('http')) {
    return {
      command: 'vscode.open',
      arguments: [uri],
      title,
    }
  }
  return {
    command: 'vscode.open',
    arguments: [uri, { selection: range, preserveFocus: true }],
    title,
  }
}

export function Command_cli(cmd: string, title = 'run...'): Command {
  cmd = cmd.trim()
  if (!(cmd.startsWith('rw') || cmd.startsWith('redwood')))
    cmd = 'redwood ' + cmd
  return { command: 'redwoodjs.cli', arguments: [cmd], title }
}

// eslint-disable-next-line @typescript-eslint/ban-types
type ReplacePropTypes<T extends {}, Replacements extends {}> = {
  [K in keyof T]: K extends keyof Replacements ? Replacements[K] : T[K]
}
