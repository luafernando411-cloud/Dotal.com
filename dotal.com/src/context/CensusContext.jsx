import { useCallback, useEffect, useMemo, useState } from 'react'
import { CensusContext } from './censusContext.js'

const STORAGE_KEY = 'censo-digital-draft'
const THEME_KEY = 'census-theme'

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch (error) {
    console.error('Não foi possível carregar o tema salvo.', error)
    return 'light'
  }
}

function readDraft() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? { dependents: [], attachments: {}, ...JSON.parse(saved) } : { dependents: [], attachments: {} }
  } catch (error) {
    console.error('Não foi possível carregar o rascunho do censo.', error)
    return { dependents: [], attachments: {} }
  }
}

export function CensusProvider({ children }) {
  const [draft, setDraft] = useState(readDraft)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [theme, setThemeState] = useState(readTheme)
  const [page, setPage] = useState('welcome')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft, (key, value) => {
          if (typeof File !== 'undefined' && value instanceof File) {
            return { name: value.name, size: value.size, type: value.type, lastModified: value.lastModified, persistedOnly: true }
          }
          return value
        }))
        setSaveStatus('saved')
      } catch (error) {
        console.error('Não foi possível salvar o rascunho do censo.', error)
        setSaveStatus('error')
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [draft])

  const updateDraft = useCallback((updates) => {
    setSaveStatus('saving')
    setDraft((current) => ({ ...current, ...updates }))
  }, [])

  const resetDraft = useCallback(() => {
    setSaveStatus('saving')
    setDraft({ dependents: [], attachments: {} })
  }, [])

  const setTheme = useCallback((nextTheme) => {
    setThemeState(nextTheme)
    try {
      localStorage.setItem(THEME_KEY, nextTheme)
    } catch (error) {
      console.error('Não foi possível salvar o tema escolhido.', error)
    }
  }, [])

  const value = useMemo(() => ({
    draft,
    updateDraft,
    resetDraft,
    saveStatus,
    theme,
    setTheme,
    page,
    setPage,
  }), [draft, updateDraft, resetDraft, saveStatus, theme, setTheme, page])

  return <CensusContext.Provider value={value}>{children}</CensusContext.Provider>
}
