import { useEffect, useMemo, useState } from 'react'
import { Field, Icon } from '../components/ui/index.jsx'
import { BrazilRegionMap } from '../components/admin/BrazilRegionMap.jsx'
import { lookupCep } from '../services/cepService.js'
import { brazilStates, getRegionByState } from '../utils/brazilRegions.js'
import { maskCep, onlyDigits } from '../utils/masks.js'

export function AddressStepView({ draft, change, onValidityChange }) {
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [notice, setNotice] = useState('')
  const digits = onlyDigits(draft.cep || '')
  const region = getRegionByState(draft.state || '')
  const valid = digits.length === 8
    && Boolean(draft.street?.trim())
    && Boolean(draft.neighborhood?.trim())
    && Boolean(draft.city?.trim())
    && Boolean(draft.state)
    && Boolean(draft.addressNumber?.trim())

  const validationMessage = useMemo(() => {
    if (!digits.length) return 'Informe o CEP para iniciar a validação do endereço.'
    if (digits.length !== 8) return 'O CEP deve conter 8 números.'
    if (!draft.state || !region) return 'Selecione uma UF válida.'
    if (!draft.street?.trim() || !draft.neighborhood?.trim() || !draft.city?.trim() || !draft.addressNumber?.trim()) {
      return 'Preencha logradouro, número, bairro e município para continuar.'
    }
    return 'Endereço validado. Você pode continuar.'
  }, [digits.length, draft.state, draft.street, draft.neighborhood, draft.city, draft.addressNumber, region])

  useEffect(() => {
    onValidityChange(valid)
  }, [valid, onValidityChange])

  useEffect(() => {
    if (digits.length !== 8) return undefined
    const timer = window.setTimeout(async () => {
      setLookupLoading(true)
      setLookupError('')
      setNotice('')
      try {
        const address = await lookupCep(digits)
        change({
          state: address.state,
          region: address.region,
          ...(address.street && { street: address.street }),
          ...(address.neighborhood && { neighborhood: address.neighborhood }),
          ...(address.city && { city: address.city }),
        })
        setNotice(address.source === 'mock'
          ? 'CEP localizado. Confira e complete os dados restantes.'
          : 'Região inferida pelo CEP. Complete o endereço manualmente.')
      } catch (error) {
        setLookupError(error.message)
      } finally {
        setLookupLoading(false)
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [digits, change])

  async function searchCep() {
    if (digits.length !== 8) {
      setLookupError('Digite um CEP com 8 números para buscar.')
      return
    }
    setLookupLoading(true)
    setLookupError('')
    setNotice('')
    try {
      const address = await lookupCep(digits)
      change({
        state: address.state,
        region: address.region,
        ...(address.street && { street: address.street }),
        ...(address.neighborhood && { neighborhood: address.neighborhood }),
        ...(address.city && { city: address.city }),
      })
      setNotice(address.source === 'mock'
        ? 'CEP localizado. Confira e complete os dados restantes.'
        : 'Região inferida pelo CEP. Complete o endereço manualmente.')
    } catch (error) {
      setLookupError(error.message)
    } finally {
      setLookupLoading(false)
    }
  }

  function changeState(value) {
    change({ state: value, region: getRegionByState(value) })
  }

  return (
    <div className="address-step">
      <div className="cep-search-row">
        <Field label="CEP" value={draft.cep || ''} onChange={(event) => change({ cep: maskCep(event.target.value) })} placeholder="00000-000" inputMode="numeric" autoComplete="postal-code" required data-testid="census-cep-input" />
        <button type="button" className="cep-search-button" onClick={searchCep} disabled={lookupLoading} data-testid="lookup-cep">
          <Icon name={lookupLoading ? 'refresh' : 'search'} size={17} />{lookupLoading ? 'Buscando' : 'Buscar CEP'}
        </button>
      </div>
      <div className={`address-validation ${valid ? 'valid' : 'invalid'}`} role="status" data-testid="address-validation">
        <Icon name={valid ? 'check' : 'info'} size={16} /><span>{validationMessage}</span>
      </div>
      {lookupError && <p className="form-error address-lookup-error" role="alert">{lookupError} Preencha o endereço abaixo manualmente.</p>}
      {notice && <p className="address-lookup-notice" role="status">{notice}</p>}
      <div className="address-grid">
        <div className="address-fields census-fields">
          <Field label="Logradouro" icon="pin" value={draft.street || ''} onChange={(event) => change({ street: event.target.value })} placeholder="Rua, avenida..." autoComplete="address-line1" required />
          <div className="field-row">
            <Field label="Número" value={draft.addressNumber || ''} onChange={(event) => change({ addressNumber: event.target.value })} placeholder="Nº" required />
            <Field label="Complemento" value={draft.complement || ''} onChange={(event) => change({ complement: event.target.value })} placeholder="Apto, bloco..." autoComplete="address-line2" />
          </div>
          <div className="field-row">
            <Field label="Bairro" value={draft.neighborhood || ''} onChange={(event) => change({ neighborhood: event.target.value })} placeholder="Seu bairro" required />
            <Field label="Cidade" value={draft.city || ''} onChange={(event) => change({ city: event.target.value })} placeholder="Sua cidade" autoComplete="address-level2" required />
          </div>
          <label className="field">
            <span className="field-label">Estado (UF)</span>
            <span className="input-wrap"><select className="census-select-input" value={draft.state || ''} onChange={(event) => changeState(event.target.value)} required data-testid="census-state-select"><option value="">Selecione o estado</option>{brazilStates.map((state) => <option value={state.uf} key={state.uf}>{state.uf} — {state.name}</option>)}</select></span>
          </label>
        </div>
        <BrazilRegionMap state={draft.state || ''} />
      </div>
    </div>
  )
}
