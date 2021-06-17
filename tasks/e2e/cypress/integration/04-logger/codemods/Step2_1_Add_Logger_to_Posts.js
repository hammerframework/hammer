export default `
import { db } from 'src/lib/db'
import { logger } from 'src/lib/logger'
import { requireAuth } from 'src/lib/auth'

// Used when the environment variable REDWOOD_SECURE_SERVICES=1
export const beforeResolver = (rules) => {
  rules.add(requireAuth)
}

export const posts = () => {
  logger.info('> in posts()')

  return db.post.findMany()
}

export const post = ({ id }) => {
  logger.info('> in post()')
  logger.debug({ postId: id }, 'Fetching post by id')

  return db.post.findUnique({
    where: { id },
  })
}

export const createPost = ({ input }) => {
  logger.info('> in createPost()')
  logger.debug({ post: input }, 'Creating post with the input')

  return db.post.create({
    data: input,
  })
}

export const updatePost = ({ id, input }) => {
  logger.info('> in updatePost()')
  logger.debug({ post: input }, 'Updating post with the input')

  return db.post.update({
    data: input,
    where: { id },
  })
}

export const deletePost = ({ id }) => {
  logger.info('> in deletePost()')
  logger.debug({ postId: id }, 'Delete post by id')

  return db.post.delete({
    where: { id },
  })
}
`
