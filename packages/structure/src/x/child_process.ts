/* eslint-disable @typescript-eslint/no-explicit-any */
import * as child_process from 'child_process'

export type SpawnOut = { stderr: string; stdout: string; code: number }

export function spawnCancellable(
  cmd: string,
  args: string[],
  opts?: child_process.SpawnOptions & {
    stdout_cb?: (x: any) => void
    stderr_cb?: (x: any) => void
  }
): CancellablePromise<SpawnOut> {
  let cp: child_process.ChildProcess
  const promise = new Promise<SpawnOut>((resolve, reject) => {
    cp = child_process.spawn(cmd, args, opts as any)
    let stderr = '',
      stdout = ''
    cp.stdout!.on('data', (data) => {
      stdout += data
      opts?.stdout_cb?.(data)
    })
    cp.stderr!.on('data', (data) => {
      stderr += data
      opts?.stderr_cb?.(data)
    })
    cp.on('close', (code) => {
      resolve({ stdout, stderr, code })
    })
    cp.on('error', (err) => {
      reject(err)
    })
  })
  ;(promise as any).cancel = () => {
    try {
      cp.kill()
    } catch (e) {
      // intentionally left empty
    }
  }
  return promise as any
}

export type CancellablePromise<T> = Promise<T> & { cancel: () => void }

export function CancellablePromise_then<T, U>(
  p: CancellablePromise<T>,
  f: (t: T) => U
): CancellablePromise<T> {
  const p2 = p.then(f)
  ;(p2 as any).cancel = p.cancel
  return p2 as any
}
