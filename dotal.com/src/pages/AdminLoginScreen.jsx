import { useState } from 'react'
import { Button, Field } from '../components/ui/index.jsx'
import { loginAdminApiUser } from '../services/apiClient.js'

export function AdminLoginScreen({ onBack, onRegister, onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      onSuccess(await loginAdminApiUser({ email, password }))
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="form-page">
      <button type="button" className="text-link align-right" onClick={onBack}>Voltar ao início</button>
      <div className="page-heading">
        <span className="eyebrow">ACESSO RESTRITO</span>
        <h1>Painel administrativo</h1>
        <p>Entre com uma conta autorizada.</p>
      </div>
      <form className="form-stack" onSubmit={handleSubmit}>
        <Field label="E-mail" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Field label="Senha" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" loading={loading}>Entrar</Button>
      </form>
      <p className="form-switch">Precisa cadastrar um administrador? <button type="button" className="text-link" onClick={onRegister}>Criar acesso</button></p>
    </section>
  )
}
