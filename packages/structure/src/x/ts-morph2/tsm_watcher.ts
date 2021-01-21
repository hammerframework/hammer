import { FSWatcher } from 'chokidar'
import invariant from 'invariant'
import { Project, ProjectOptions } from 'ts-morph'

interface TsMorphWatcherFsEvent {
  type: 'add' | 'unlink' | 'change'
  path: string
}

type TsMorphWatcherEvent = TsMorphWatcherFsEvent | { type: 'ready' }

class PromiseSignal<T> {
  private promise: Promise<T>
  private resolve?: (value: T) => void
  private resolved = false

  constructor() {
    this.promise = new Promise((resolve) => {
      this.resolve = resolve
    })
  }

  getPromise() {
    return this.promise
  }

  notify(value: T) {
    invariant(!this.resolved, 'already resolved')
    this.resolved = true
    this.resolve!(value)
  }
}

export class TsMorphWatcher {
  private project: Project
  private started = false
  private ready = false
  private eventQueue: TsMorphWatcherEvent[] = []
  private signal = new PromiseSignal<void>()
  private lastError: Error | null = null

  constructor(
    private watcher: FSWatcher,
    private projectOptions: ProjectOptions
  ) {
    this.project = new Project(this.projectOptions)
  }

  async stop() {
    this.started = false
  }

  async getNext(): Promise<Project> {
    if (this.lastError) {
      const lastError = this.lastError
      this.lastError = null
      throw lastError
    }

    if (!this.started) {
      await this.start()
    }

    if (this.eventQueue.length === 0) {
      await this.signal.getPromise()
    }

    const eventQueue = this.eventQueue
    this.eventQueue = []
    this.signal = new PromiseSignal()

    for (let event of eventQueue) {
      if (event.type === 'add') {
        this.project!.addSourceFileAtPath(event.path)
      } else if (event.type === 'change') {
        const path = event.path.toLowerCase()
        if (path.indexOf('tsconfig') > -1 && path.endsWith('.json')) {
          // create a fresh project when the tsconfig changes
          this.project = new Project(this.projectOptions)
        } else {
          const sourceFile = this.project!.getSourceFile(event.path)
          if (sourceFile) {
            await sourceFile.refreshFromFileSystem()
          }
        }
      } else if (event.type === 'unlink') {
        const sourceFile = this.project!.getSourceFile(event.path)
        if (sourceFile) {
          this.project!.removeSourceFile(sourceFile)
        }
      } else {
        // on ready, do nothing.
      }
    }

    return this.project
  }

  private pushEvent(event: TsMorphWatcherEvent) {
    this.eventQueue.push(event)
    if (this.eventQueue.length === 1) {
      this.signal.notify()
    }
  }

  private async start() {
    invariant(!this.started, 'already started')
    this.started = true

    this.ready = false
    this.project = new Project(this.projectOptions)

    this.watcher.on('ready', () => {
      this.ready = true
      this.pushEvent({ type: 'ready' })
    })

    this.watcher.on('add', (path) => {
      if (!this.ready) {
        return
      }

      this.pushEvent({ type: 'add', path })
    })

    this.watcher.on('change', async (path) => {
      this.pushEvent({ type: 'change', path })
    })

    this.watcher.on('unlink', (path) => {
      this.pushEvent({ type: 'unlink', path })
    })

    this.watcher.on('error', (err) => {
      this.lastError = err
    })
  }
}

// async function example() {
//   // example usage:
//   const watcher = new TsMorphWatcher({
//     tsConfigFilePath: require.resolve('../tsconfig.json'),
//   })

//   while (true) {
//     // getNext() waits until there is a change and returns a ts-morph Project instance.
//     // during getNext() it will update the project with any changes from the filesystem.
//     // getNext() will return a fresh Project instance if any file named tsconfig.json
//     // changes.
//     const project = await watcher.getNext()
//     // do something with project
//   }
// }
