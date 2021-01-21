import { resolve } from 'path'

export function getFixtureDir(
  name: 'example-todo-main-with-errors' | 'example-todo-main'
) {
  return resolve(__dirname, `../../../../../../__fixtures__/${name}`)
}
