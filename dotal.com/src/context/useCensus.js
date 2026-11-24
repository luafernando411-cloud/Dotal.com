import { useContext } from 'react'
import { CensusContext } from './censusContext.js'

export function useCensus() {
  const context = useContext(CensusContext)
  if (!context) throw new Error('useCensus deve ser usado dentro de CensusProvider.')
  return context
}
