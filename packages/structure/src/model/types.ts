import { Command, Location } from 'vscode-languageserver'
import { lazy, memo } from '../x/decorators'
import { Command_open, TreeItem2 } from '../x/vscode'

export interface OutlineInfoProvider {
  id?: string
  uri?: string
  location?: Location
  /**
   * overrides #location if present
   */
  outlineLocation?: Location
  outlineLabel?: string
  outlineDescription?: string
  outlineIcon?: string
  outlineChildren?: CollectionOf<OutlineInfoProvider>
  outlineCommand?: Command
  outlineTooltip?: string
  outlineCLICommands?: OutlineCLICommand[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outlineMenu?: any
  outlineExtends?: OutlineInfoProvider
}

// we use this example to extract keys at runtime
const OutlineInfoProvider_example: OutlineInfoProvider = {
  id: '',
  uri: '',
  location: ({} as any) as Location,
  outlineLocation: ({} as any) as Location,
  outlineLabel: '',
  outlineDescription: '',
  outlineIcon: '',
  outlineChildren: [],
  outlineCommand: ({} as any) as Command,
  outlineTooltip: '',
  outlineCLICommands: [],
  outlineMenu: null as any,
  outlineExtends: {},
}

const OutlineInfoProvider_keys: (keyof OutlineInfoProvider)[] = Object.keys(
  OutlineInfoProvider_example
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as any

/**
 * A Redwood CLI command:
 * ex: "rw g..."
 */
interface OutlineCLICommand {
  cmd: string
  tooltip: string
}

type Nil = null | undefined
type SparseIter<T> = Iterable<T | Nil>
type ValueOrFunction<T> = T | (() => T)
type CollectionOf<T> = ValueOrFunction<
  Nil | SparseIter<T> | Thenable<SparseIter<T>>
>

function OutlineInfoProvider_resolveExtends(info: OutlineInfoProvider) {
  const base = info.outlineExtends
  if (!base) return info
  // start with a fresh object
  const info2: OutlineInfoProvider = {}
  // copy over props from base
  for (const k of OutlineInfoProvider_keys) {
    info2[k] = getAndBind(base, k)
  }
  // and now copy over props from self, except for outlineExtends (or this would loop forever)
  for (const k of OutlineInfoProvider_keys) {
    if (k === 'outlineExtends') continue
    info2[k] = getAndBind(info, k)
  }
  return OutlineInfoProvider_resolveExtends(info2)
}

export class OutlineInfoResolver {
  constructor(public o: OutlineInfoProvider) {}
  @memo() async children() {
    const cc = await Values_normalize(getAndBind(this.o, 'outlineChildren'))
    return cc.map((x) => new OutlineInfoResolver(x))
  }
  @lazy() get noChildren() {
    return isNullOrUndefined(this.o.outlineChildren)
  }
  @memo() async treeItem(): Promise<TreeItem2> {
    const info = OutlineInfoProvider_resolveExtends(this.o) //await this.info()
    let command: Command | undefined
    if (info.uri) command = Command_open(info.uri)
    const location = info.outlineLocation ?? info.location
    if (location) command = Command_open(location)
    const key = info.id ?? info.uri ?? info.outlineLabel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let children: any
    if (!this.noChildren) children = () => this.children_treeItem()
    // TODO: cli commands, menus, etc
    return {
      label: info.outlineLabel,
      description: info.outlineDescription,
      iconPath: info.outlineIcon,
      resourceUri: info.uri,
      menu: info.outlineMenu,
      tooltip: info.outlineTooltip,
      command,
      key,
      children,
    }
  }
  @memo() async children_treeItem() {
    const c = await this.children()
    return await Promise.all(c.map((cc) => cc.treeItem()))
  }
}

async function Value_normalize(x) {
  if (Thenable_is(x)) return await Value_normalize(await x)
  if (typeof x === 'function') return await Value_normalize(x())
  if (x === null) return undefined
  return x
}

async function Values_normalize(v) {
  const xx = await Value_normalize(v)
  if (!xx) return []
  const arr = Promise.all(Array.from(xx).map(Value_normalize))
  return (await arr).filter((x) => typeof x !== 'undefined')
}

function Thenable_is(x: unknown): x is Thenable<unknown> {
  if (typeof x !== 'object') return false
  if (x === null) return false
  return typeof x['then'] === 'function'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAndBind(o: Record<string, any>, k: string) {
  return typeof o[k] === 'function' ? o[k].bind(o) : o[k]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isNullOrUndefined(x: any) {
  if (x === null) return true
  if (typeof x === 'undefined') return true
  return false
}
