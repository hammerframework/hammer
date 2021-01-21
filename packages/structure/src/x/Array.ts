export type ArrayLike<T> =
  | T[]
  | Promise<T[]>
  | IterableIterator<T>
  | undefined
  | void
  | null

export async function ArrayLike_normalize<T>(x: ArrayLike<T>): Promise<T[]> {
  if (x instanceof Promise) return x
  if (x === null) return []
  if (typeof x === 'undefined') return []
  return [...x]
}

export function iter<T>(f: () => IterableIterator<T>) {
  return Array.from(f())
}

export function Array_collectInstancesOf<T>(
  // eslint-disable-next-line @typescript-eslint/ban-types
  c: Function & { prototype: T },
  xs: Array<unknown> | undefined
): Array<T> {
  return iter(function* () {
    if (xs) for (const x of xs) if (x instanceof c) yield x as T
  })
}
