"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

interface MockDataState {
  isMockActive: boolean
  mockReasons: string[]
}

interface MockDataContextValue extends MockDataState {
  reportMockFallback: (hookName: string, reason: string) => void
}

const MockDataContext = createContext<MockDataContextValue>({
  isMockActive: false,
  mockReasons: [],
  reportMockFallback: () => {},
})

export function MockDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MockDataState>({
    isMockActive: false,
    mockReasons: [],
  })

  const reportMockFallback = useCallback((hookName: string, reason: string) => {
    const entry = `${hookName}: ${reason}`

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[MockData] ${entry}`)
    }

    setState(prev => {
      if (prev.mockReasons.includes(entry)) return prev
      return {
        isMockActive: true,
        mockReasons: [...prev.mockReasons, entry],
      }
    })
  }, [])

  return (
    <MockDataContext.Provider value={{ ...state, reportMockFallback }}>
      {children}
    </MockDataContext.Provider>
  )
}

export function useMockDataContext() {
  return useContext(MockDataContext)
}
