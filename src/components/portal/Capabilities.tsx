'use client'

import { createContext, useContext, type ReactNode } from 'react'

const PortalCapabilities = createContext({ clientDailyLimits: false })

export function PortalCapabilitiesProvider({ clientDailyLimits, children }: { clientDailyLimits: boolean; children: ReactNode }) {
  return <PortalCapabilities.Provider value={{ clientDailyLimits }}>{children}</PortalCapabilities.Provider>
}

export const usePortalCapabilities = () => useContext(PortalCapabilities)
