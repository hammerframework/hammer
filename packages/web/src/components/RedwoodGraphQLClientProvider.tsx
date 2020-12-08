import type { AuthContextInterface } from '@redwoodjs/auth'

import { FetchConfigProvider } from 'src/components/FetchConfigProvider'
import { GraphQLHooksProvider } from 'src/components/GraphQLHooksProvider'
import { FlashProvider } from 'src/flash'
import { useMutation } from 'src/graphql/useMutation'
import { useQuery } from 'src/graphql/useQuery'

export const RedwoodGraphQLClientProvider: React.FC<{
  useAuth: () => AuthContextInterface
}> = ({ useAuth, children }) => {
  return (
    <FetchConfigProvider useAuth={useAuth}>
      <GraphQLHooksProvider useQuery={useQuery} useMutation={useMutation}>
        <FlashProvider>{children}</FlashProvider>
      </GraphQLHooksProvider>
    </FetchConfigProvider>
  )
}
