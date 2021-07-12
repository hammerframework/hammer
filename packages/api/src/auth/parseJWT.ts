const appMetadata = (token: {
  decoded: { [index: string]: Record<string, unknown> }
  namespace?: string
}): any => {
  const claim = token.namespace
    ? `${token.namespace}/app_metadata`
    : 'app_metadata'
  return token.decoded?.[claim] || {}
}

const roles = (token: {
  decoded: { [index: string]: Record<string, unknown> }
  namespace?: string
}): any => {
  const metadata = appMetadata(token)
  return (
    token.decoded?.roles ||
    metadata?.roles ||
    metadata.authorization?.roles ||
    []
  )
}

export const parseJWT = (token: {
  decoded: { [index: string]: Record<string, unknown> }
  namespace?: string
}): any => {
  return {
    appMetadata: appMetadata(token),
    roles: roles(token),
  }
}
