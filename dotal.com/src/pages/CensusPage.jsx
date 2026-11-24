import { useCallback, useState } from 'react'
import { Button, Field, Icon } from '../components/ui/index.jsx'
import { ProgressBar } from '../components/ui/ProgressBar.jsx'
import { DocumentUploadStep } from '../components/ui/DocumentUploadStep.jsx'
import { useCensus } from '../context/useCensus.js'
import { buildCensusFormData, submitCensus } from '../services/censusService.js'
import { maskCpf, maskPhone, isValidCpf } from '../utils/masks.js'
import { AddressStepView } from './AddressStepView.jsx'

const steps = [
  { title: 'Dados pessoais e vínculo', shortTitle: 'Dados pessoais', icon: 'user' },
  { title: 'Endereço', shortTitle: 'Endereço', icon: 'pin' },
  { title: 'Documentos', shortTitle: 'Documentos', icon: 'file' },
  { title: 'Dependentes e revisão', shortTitle: 'Revisão', icon: 'users' },
]

export function CensusPage({ onSuccess }) {
  const { draft, updateDraft, saveStatus, theme } = useCensus()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [addressValid, setAddressValid] = useState(false)
  const currentStep = steps[step]

  const change = useCallback((updates, value) => {
    updateDraft(typeof updates === 'string' ? { [updates]: value } : updates)
  }, [updateDraft])

  function next() {
    setError('')
    if (step === 0) {
      if (!draft.fullName?.trim() || draft.fullName.trim().split(/\s+/).length < 2) return setError('Informe seu nome e sobrenome.')
      if (!isValidCpf(draft.cpf || '')) return setError('Informe um CPF válido.')
      if (!draft.identityNumber?.trim()) return setError('Informe seu RG ou documento de identidade.')
      if (!draft.maritalStatus) return setError('Selecione seu estado civil.')
      if (!draft.employmentStatus) return setError('Selecione seu vínculo funcional.')
    }
    if (step === 1 && !addressValid) return setError('Complete e valide os campos obrigatórios do endereço.')
    if (step === 2) {
      const currentAttachments = draft.attachments || {}
      const hasIdentity = currentAttachments.identity?.some((file) => !file.persistedOnly)
      const hasPhoto = currentAttachments.photo?.some((file) => !file.persistedOnly)
      if (!hasIdentity || !hasPhoto) return setError('Anexe o documento de identidade e a foto 3x4 para continuar.')
    }
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  async function finish() {
    const dependents = draft.dependents || []
    if (dependents.some((dependent) => !dependent.name?.trim() || !dependent.relationship?.trim())) {
      setError('Preencha nome e parentesco de todos os dependentes adicionados.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const formData = buildCensusFormData(draft)
      const result = await submitCensus(draft, formData)
      onSuccess(result.protocol)
    } catch (submitError) {
      setError(submitError.message || 'Não foi possível enviar o recenseamento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="census-page census-form-screen" data-theme={theme} data-testid="census-form-screen">
      <header className="census-header">
        <div className="census-brand"><span className="census-brand-mark"><Icon name="shield" size={21} /></span><span>Censo<span>Digital</span></span></div>
        <span className="secure-pill"><Icon name="lock" size={13} /> Seguro</span>
      </header>
      <ProgressBar current={step + 1} total={steps.length} />
      <div className="step-tabs" aria-label="Etapas do formulário">
        {steps.map((item, index) => (
          <div className={`step-tab ${index === step ? 'active' : ''} ${index < step ? 'complete' : ''}`} key={item.title}>
            <span className="step-tab-icon">{index < step ? <Icon name="check" size={15} /> : <Icon name={item.icon} size={16} />}</span>
            <span className="step-tab-title">{item.shortTitle}</span>
          </div>
        ))}
      </div>
      <div className="census-content">
        <span className="eyebrow">ETAPA {step + 1}</span>
        <h1>{currentStep.title}</h1>
        <p className="census-intro">{step === 2 ? 'Anexe os documentos necessários para conferência do cadastro.' : step === 3 ? 'Revise seus dados e informe as pessoas dependentes.' : 'Mantenha suas informações atualizadas para um atendimento melhor.'}</p>
        {step === 0 && <PersonalFields draft={draft} change={change} />}
        {step === 1 && <AddressStepView draft={draft} change={change} onValidityChange={setAddressValid} />}
        {step === 2 && <DocumentUploadStep attachments={draft.attachments || {}} onChange={(attachments) => change({ attachments })} />}
        {step === 3 && <SummaryFields draft={draft} change={change} />}
        {error && <p className="form-error census-form-error" role="alert" data-testid="census-form-error">{error}</p>}
        <div className="census-actions">
          {step > 0 && <Button variant="subtle" onClick={() => { setError(''); setStep((current) => current - 1) }}><Icon name="arrow" size={18} /> Voltar</Button>}
          {step < 3
            ? <Button onClick={next} data-testid="census-continue">Continuar <Icon name="arrowRight" size={18} /></Button>
            : <Button onClick={finish} loading={loading} data-testid="submit-census">Enviar recenseamento <Icon name="check" size={18} /></Button>}
        </div>
        <div className="draft-note" role="status" data-testid="draft-save-status">
          <Icon name={saveStatus === 'saved' ? 'check' : saveStatus === 'error' ? 'info' : 'refresh'} size={15} />
          <span>{saveStatus === 'saving' ? 'Salvando seu rascunho...' : saveStatus === 'error' ? 'Não foi possível salvar. Verifique o espaço disponível.' : 'Rascunho salvo automaticamente neste dispositivo.'}</span>
        </div>
      </div>
    </section>
  )
}

function PersonalFields({ draft, change }) {
  const categories = [
    { key: 'Ativo', icon: 'briefcase', description: 'Em exercício de suas funções' },
    { key: 'Aposentado', icon: 'user', description: 'Aposentadoria registrada' },
    { key: 'Pensionista', icon: 'users', description: 'Beneficiário de pensão' },
  ]
  return (
    <div className="census-fields">
      <Field label="Nome completo" icon="user" value={draft.fullName || ''} onChange={(event) => change('fullName', event.target.value)} placeholder="Seu nome completo" autoComplete="name" required data-testid="census-full-name" />
      <div className="field-row">
        <Field label="CPF" value={draft.cpf || ''} onChange={(event) => change('cpf', maskCpf(event.target.value))} placeholder="000.000.000-00" inputMode="numeric" autoComplete="off" required data-testid="census-cpf" />
        <Field label="RG / Identidade" value={draft.identityNumber || ''} onChange={(event) => change('identityNumber', event.target.value)} placeholder="Número do documento" required data-testid="census-identity-number" />
      </div>
      <div className="field-row">
        <Field label="Data de nascimento" icon="calendar" type="date" value={draft.birthDate || ''} onChange={(event) => change('birthDate', event.target.value)} autoComplete="bday" />
        <label className="field"><span className="field-label">Estado civil</span><span className="input-wrap"><select className="census-select-input" value={draft.maritalStatus || ''} onChange={(event) => change('maritalStatus', event.target.value)} required data-testid="marital-status-select"><option value="">Selecione</option>{['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'].map((status) => <option key={status}>{status}</option>)}</select></span></label>
      </div>
      <Field label="E-mail" icon="mail" type="email" value={draft.email || ''} onChange={(event) => change('email', event.target.value)} placeholder="seu@email.com" autoComplete="email" />
      <Field label="Celular" icon="phone" type="tel" value={draft.phone || ''} onChange={(event) => change('phone', maskPhone(event.target.value))} placeholder="(00) 00000-0000" autoComplete="tel" />
      <div className="employment-section">
        <span className="field-label">Vínculo funcional</span>
        <div className="employment-options">
          {categories.map((category) => (
            <button key={category.key} type="button" className={`employment-card ${draft.employmentStatus === category.key ? 'selected' : ''}`} onClick={() => change('employmentStatus', category.key)} aria-pressed={draft.employmentStatus === category.key} data-testid={`employment-${category.key.toLowerCase()}`}>
              <span className="employment-icon"><Icon name={category.icon} size={19} /></span>
              <span><strong>{category.key}</strong><small>{category.description}</small></span>
              <span className="selection-check">{draft.employmentStatus === category.key && <Icon name="check" size={14} />}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="field-row">
        <Field label="Matrícula funcional" value={draft.registration || ''} onChange={(event) => change('registration', event.target.value)} placeholder="Se aplicável" />
        <Field label="Órgão / lotação" value={draft.department || ''} onChange={(event) => change('department', event.target.value)} placeholder="Órgão ou setor" />
      </div>
      <Field label={draft.employmentStatus === 'Ativo' ? 'Data de admissão' : 'Data de concessão'} icon="calendar" type="date" value={draft.employmentDate || ''} onChange={(event) => change('employmentDate', event.target.value)} />
    </div>
  )
}

function SummaryFields({ draft, change }) {
  const dependents = draft.dependents || []

  function updateDependent(id, updates) {
    change({ dependents: dependents.map((dependent) => dependent.id === id ? { ...dependent, ...updates } : dependent) })
  }

  function addDependent() {
    change({ dependents: [...dependents, { id: `dependent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: '', relationship: '', cpf: '' }] })
  }

  function removeDependent(id) {
    change({ dependents: dependents.filter((dependent) => dependent.id !== id) })
  }

  return (
    <div className="census-fields">
      <div className="dependents-heading"><span><strong>Dependentes</strong><small>Adicione as pessoas vinculadas ao seu cadastro.</small></span><button type="button" className="add-dependent-button" onClick={addDependent} data-testid="add-dependent"><Icon name="users" size={15} />Adicionar</button></div>
      {dependents.map((dependent, index) => (
        <div className="dependent-card" key={dependent.id} data-testid={`dependent-${index}`}>
          <div className="dependent-card-heading"><strong>Dependente {index + 1}</strong><button type="button" onClick={() => removeDependent(dependent.id)} aria-label={`Remover dependente ${index + 1}`}><Icon name="close" size={15} /></button></div>
          <Field label="Nome completo" value={dependent.name} onChange={(event) => updateDependent(dependent.id, { name: event.target.value })} placeholder="Nome do dependente" />
          <div className="field-row">
            <Field label="Parentesco" value={dependent.relationship} onChange={(event) => updateDependent(dependent.id, { relationship: event.target.value })} placeholder="Ex.: filho(a)" />
            <Field label="CPF" value={dependent.cpf} onChange={(event) => updateDependent(dependent.id, { cpf: maskCpf(event.target.value) })} placeholder="000.000.000-00" inputMode="numeric" />
          </div>
        </div>
      ))}
      <div className="summary-card">
        <div className="summary-title"><span>Conferência final</span><Icon name="check" size={17} /></div>
        <SummaryLine label="Nome" value={draft.fullName} />
        <SummaryLine label="CPF / RG" value={`${draft.cpf || 'Não informado'} / ${draft.identityNumber || 'Não informado'}`} />
        <SummaryLine label="Estado civil" value={draft.maritalStatus} />
        <SummaryLine label="Vínculo funcional" value={draft.employmentStatus} />
        <SummaryLine label="Matrícula / órgão" value={`${draft.registration || 'Não informado'} / ${draft.department || 'Não informado'}`} />
        <SummaryLine label="Endereço" value={[draft.street, draft.addressNumber, draft.neighborhood, draft.city, draft.state].filter(Boolean).join(', ')} />
        <SummaryLine label="CEP / região" value={`${draft.cep || 'Não informado'} / ${draft.region || 'Não informada'}`} />
        <SummaryLine label="Dependentes" value={dependents.length} />
      </div>
    </div>
  )
}

function SummaryLine({ label, value }) {
  return <div className="summary-line"><span>{label}</span><strong>{value || 'Não informado'}</strong></div>
}
