import { useState } from 'react'
import { BackHeader, Brand, Button, Field, PageHeading } from '../components/ui/index.jsx'
import { useCensus } from '../context/useCensus.js'
import { isValidCpf, maskCpf, maskPhone, onlyDigits } from '../utils/masks.js'
import { loginApiUser, registerApiUser } from '../services/apiClient.js'

export function SignupPage({ onBack, onContinue }) {
  const { draft, updateDraft } = useCensus()
  const [form, setForm] = useState(() => ({
    fullName: draft.fullName || '',
    cpf: draft.cpf || '',
    email: draft.email || '',
    phone: draft.phone || '',
    birthDate: draft.birthDate || '',
    password: '',
  }))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  async function handleSubmit(event) {
    event.preventDefault()
    if (form.fullName.trim().split(/\s+/).length < 2) return setError('Informe seu nome e sobrenome.')
    if (!isValidCpf(form.cpf)) return setError('Informe um CPF válido.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Informe um e-mail válido.')
    if (onlyDigits(form.phone).length < 10) return setError('Informe um celular com DDD.')
    if (!form.birthDate || new Date(form.birthDate) > new Date()) return setError('Informe uma data de nascimento válida.')
    if (form.password.length < 8 || !/[a-z]/i.test(form.password) || !/\d/.test(form.password)) {
      return setError('A senha deve ter pelo menos 8 caracteres, incluindo letras e números.')
    }
    const registrationDraft = { ...form }
    delete registrationDraft.password
    setError('')
    setLoading(true)
    try {
      const credentials = {
        cpf: onlyDigits(form.cpf),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
      }
      await registerApiUser(credentials)
      await loginApiUser({ cpf: credentials.cpf, password: credentials.password })
      updateDraft(registrationDraft)
      onContinue()
    } catch (registrationError) {
      setError(registrationError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="form-page signup-page">
      <BackHeader onBack={onBack} />
      <Brand compact />
      <PageHeading eyebrow="SEU PRIMEIRO ACESSO" title="Vamos começar" description="Preencha seus dados para criar seu acesso ao Censo Digital." />
      <form className="form-stack signup-form" onSubmit={handleSubmit}>
        <Field label="Nome completo" icon="user" placeholder="Como podemos te chamar?" autoComplete="name" value={form.fullName} onChange={(event) => change('fullName', event.target.value)} required data-testid="signup-full-name" />
        <div className="field-row">
          <Field label="CPF" placeholder="000.000.000-00" inputMode="numeric" autoComplete="off" value={form.cpf} onChange={(event) => change('cpf', maskCpf(event.target.value))} required data-testid="signup-cpf" />
          <Field label="Data de nascimento" icon="calendar" type="date" autoComplete="bday" value={form.birthDate} onChange={(event) => change('birthDate', event.target.value)} required />
        </div>
        <Field label="E-mail" icon="mail" type="email" placeholder="seu@email.com" autoComplete="email" value={form.email} onChange={(event) => change('email', event.target.value)} required />
        <Field label="Celular" icon="phone" type="tel" placeholder="(00) 00000-0000" autoComplete="tel" inputMode="tel" value={form.phone} onChange={(event) => change('phone', maskPhone(event.target.value))} required />
        <Field label="Crie uma senha" type="password" placeholder="8+ caracteres com letras e números" autoComplete="new-password" value={form.password} onChange={(event) => change('password', event.target.value)} required minLength={8} />
        {error && <p className="form-error" role="alert" data-testid="signup-error">{error}</p>}
        <Button type="submit" loading={loading}>Continuar para Verificação <span aria-hidden="true">→</span></Button>
      </form>
      <p className="legal-note">Ao continuar, você concorda com nossos <button type="button" className="text-link">termos de uso</button> e <button type="button" className="text-link">política de privacidade</button>.</p>
    </section>
  )
}
