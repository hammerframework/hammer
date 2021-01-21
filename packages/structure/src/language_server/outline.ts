import { OutlineInfoResolver } from 'src/model/types'
//import { getOutline } from '../outline/outline'
import { memo } from '../x/decorators'
import {
  RemoteTreeDataProviderImpl,
  RemoteTreeDataProvider_publishOverLSPConnection,
} from '../x/vscode'

import { RWLanguageServer } from './RWLanguageServer'

const USE_NEW_OUTLINE = true as const

export class OutlineManager {
  constructor(public server: RWLanguageServer) {}

  @memo() start() {
    const getRoot = async () => {
      const p = this.server.getProject()
      if (!p)
        return {
          async children() {
            return [{ label: 'No Redwood.js project found...' }]
          },
        }
      // eslint-disable-next-line no-constant-condition
      if (USE_NEW_OUTLINE) {
        const oif = new OutlineInfoResolver(p)
        return await oif.treeItem()
      } else {
        //return getOutline(p)
        throw new Error()
      }
    }

    const tdp = new RemoteTreeDataProviderImpl(getRoot, 10000)
    const methodPrefix = 'redwoodjs/x-outline-'
    RemoteTreeDataProvider_publishOverLSPConnection(
      tdp,
      this.server.connection,
      methodPrefix
    )
  }
}
