import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type CompanyContextType = {
  selectedCompany: string
  setSelectedCompany: (company: string) => void
  selectedPoint: string
  setSelectedPoint: (point: string) => void
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [selectedCompany, setSelectedCompany] = useState(() => localStorage.getItem('rg:selected-company') || '01')
  const [selectedPoint, setSelectedPoint] = useState(() => localStorage.getItem('rg:selected-point') || '01')

  useEffect(() => {
    localStorage.setItem('rg:selected-company', selectedCompany)
  }, [selectedCompany])

  useEffect(() => {
    localStorage.setItem('rg:selected-point', selectedPoint)
  }, [selectedPoint])

  return (
    <CompanyContext.Provider
      value={{
        selectedCompany,
        setSelectedCompany,
        selectedPoint,
        setSelectedPoint,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be used inside CompanyProvider')
  return ctx
}
