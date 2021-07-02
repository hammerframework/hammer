import { db } from 'src/lib/db'

export const todos = () => db.todo.findMany()

export const createTodo = ({ body }) => db.todo.create({ data: { body } })

export const numTodos = () => {
  return context.currentUser
}

export const updateTodoStatus = ({ id, status }) =>
  db.todo.update({
    data: { status },
    where: { id },
  })

export const renameTodo = ({ id, body }) =>
  db.todo.update({
    data: { body },
    where: { id },
  })
