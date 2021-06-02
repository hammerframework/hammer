/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'

import {
  GraphQLHooksProvider,
  useQuery,
  useMutation,
} from './GraphQLHooksProvider'

const TestUseQueryHook: React.FunctionComponent = () => {
  // @ts-expect-error - Purposefully not passing in a DocumentNode type here.
  const result = useQuery('query TestQuery { answer }', {
    variables: {
      question: 'What is the answer to life, the universe and everything?',
    },
  })

  return <>{JSON.stringify(result)}</>
}

const TestUseMutationHook: React.FunctionComponent = () => {
  // @ts-expect-error - Purposefully not passing in a DocumentNode type here.
  const result = useMutation('mutation UpdateThing(input: "x") { answer }', {
    variables: {
      question: 'What is the answer to life, the universe and everything?',
    },
  })

  return <>{JSON.stringify(result)}</>
}

describe('QueryHooksProvider', () => {
  test('useQueryHook is called with the correct query and arguments', (done) => {
    const myUseQueryHook = (query, options) => {
      expect(query).toEqual('query TestQuery { answer }')
      expect(options.variables.question).toEqual(
        'What is the answer to life, the universe and everything?'
      )
      done()
      return { loading: false, data: { answer: 42 } }
    }
    render(
      <GraphQLHooksProvider useQuery={myUseQueryHook} useMutation={null}>
        <TestUseQueryHook />
      </GraphQLHooksProvider>
    )
  })

  test('useMutationHook is called with the correct query and arguments', (done) => {
    const myUseMutationHook = (query, options) => {
      expect(query).toEqual('mutation UpdateThing(input: "x") { answer }')
      expect(options.variables.question).toEqual(
        'What is the answer to life, the universe and everything?'
      )
      done()
      return { loading: false, data: { answer: 42 } }
    }
    render(
      <GraphQLHooksProvider useQuery={null} useMutation={myUseMutationHook}>
        <TestUseMutationHook />
      </GraphQLHooksProvider>
    )
  })

  test('useQueryHook returns the correct result', async () => {
    const myUseQueryHook = () => {
      return { loading: false, data: { answer: 42 } }
    }
    render(
      <GraphQLHooksProvider useQuery={myUseQueryHook} useMutation={null}>
        <TestUseQueryHook />
      </GraphQLHooksProvider>
    )
    await waitFor(() =>
      screen.getByText('{"loading":false,"data":{"answer":42}}')
    )
  })

  test('useMutationHook returns the correct result', async () => {
    const myUseMutationHook = () => {
      return { loading: false, data: { answer: 42 } }
    }
    render(
      <GraphQLHooksProvider useQuery={null} useMutation={myUseMutationHook}>
        <TestUseMutationHook />
      </GraphQLHooksProvider>
    )
    await waitFor(() =>
      screen.getByText('{"loading":false,"data":{"answer":42}}')
    )
  })
})
