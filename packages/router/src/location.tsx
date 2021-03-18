import React, { useContext, useEffect, useRef, useState } from 'react'

import { useHistory } from '@redwoodjs/history'

import { createNamedContext, gHistory } from './internal'

export interface LocationContextType {
  pathname: string
  search?: string
  hash?: string
}

const LocationContext = createNamedContext<LocationContextType>('Location')

interface Props {
  children: React.ReactNode
  location?: LocationContextType
}

const getContext = (
  parentLocation: LocationContextType | undefined,
  location: LocationContextType | undefined
) => {
  const windowLocation =
    typeof window !== 'undefined'
      ? window.location
      : {
          pathname: parentLocation?.pathname || '',
          search: parentLocation?.search || '',
          hash: parentLocation?.hash || '',
        }
  const { pathname, search, hash } = location || windowLocation

  return { pathname, search, hash }
}

const LocationProvider: React.FC<Props> = ({ children, location }) => {
  const HISTORY_LISTENER_ID = useRef<string | undefined>(undefined)
  const parentLocation = useContext(LocationContext)
  const [context, setContext] = useState(getContext(parentLocation, location))
  const history = useHistory()

  useEffect(() => {
    HISTORY_LISTENER_ID.current = gHistory.listen(() => {
      setContext(getContext(parentLocation, location))
    })

    history.addListener(() => {
      setContext(getContext(parentLocation, location))
    })

    return () => {
      if (HISTORY_LISTENER_ID.current) {
        gHistory.remove(HISTORY_LISTENER_ID.current)
      }
    }
  }, [parentLocation, location, history])

  return (
    <LocationContext.Provider value={context}>
      {children}
    </LocationContext.Provider>
  )
}

const useLocation = () => {
  const location = useContext(LocationContext)

  if (location === undefined) {
    throw new Error('useLocation must be used within a LocationProvider')
  }

  return location
}

export { LocationProvider, LocationContext, useLocation }
