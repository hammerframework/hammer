import { AuthenticationError } from '@redwoodjs/api'

import { db } from './db'

// See https://redwoodjs.com/cookbook/role-based-access-control-rbac
// for how to add Role-based Access Control (RBAC) here.

export const getCurrentUser = async (decoded) => {
  return db.user.findUnique({ where: { address: decoded.address } })
}

/**
 * The user is authenticated if there is a currentUser in the context
 *
 * @returns {boolean} - If the currentUser is authenticated
 */
export const isAuthenticated = () => {
  return !!context.currentUser
}

// Use this function in your services to check that a user is logged in, and
// optionally raise an error if they're not.

export const requireAuth = () => {
  if (!context.currentUser) {
    throw new AuthenticationError("You don't have permission to do that.")
  }
}
