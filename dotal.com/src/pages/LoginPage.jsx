import { useState } from 'react'
import { loginCensus } from '../services/censusService.js'
import { BackHeader, Brand, Button, Field, PageHeading } from '../components/ui/index.jsx'
import { isValidCpf, maskCpf } from '../utils/masks.js'

export function LoginPage({ onBack, onSignup, onSuccess }) {
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!isValidCpf(cpf)) {
      setError('Informe um CPF válido.')
      return
    }
    setLoading(true)
    try {
      await loginCensus({ cpf, password })
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="form-page">
      <BackHeader onBack={onBack} action={onSignup} actionLabel="Criar conta" />
      <Brand compact />
      <PageHeading eyebrow="BEM-VINDO DE VOLTA" title="Acesse sua conta" description="Entre para continuar seu recenseamento." />
      <form className="form-stack" onSubmit={handleSubmit}>
        <Field label="CPF" icon="user" placeholder="000.000.000-00" autoComplete="username" inputMode="numeric" value={cpf} onChange={(event) => setCpf(maskCpf(event.target.value))} required />
        <Field label="Senha" type="password" placeholder="Digite sua senha" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <span className="text-link align-right">A senha deve ter pelo menos 8 caracteres.</span>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" loading={loading}>Entrar</Button>
      </form>
      <p className="form-switch">Ainda não tem acesso? <button type="button" className="text-link" onClick={onSignup}>Primeiro acesso</button></p>
    </section>
  )
}
