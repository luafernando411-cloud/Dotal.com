import { useState } from 'react'
import { Button, Field } from '../components/ui/index.jsx'
import { registerAdminApiUser } from '../services/apiClient.js'

export function AdminRegisterScreen({ onBack, onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registrationKey, setRegistrationKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await registerAdminApiUser({ email, password, registration_key: registrationKey })
      onSuccess()
    } catch (registrationError) {
      setError(registrationError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="form-page">
      <button type="button" className="text-link align-right" onClick={onBack}>Voltar ao login administrativo</button>
      <div className="page-heading">
        <span className="eyebrow">ACESSO RESTRITO</span>
        <h1>Criar conta administrativa</h1>
        <p>O cadastro exige a chave de provisionamento fornecida pela equipe responsável.</p>
      </div>
      <form className="form-stack" onSubmit={handleSubmit}>
        <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Field label="Senha forte" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} required />
        <small>Use 12+ caracteres, incluindo maiúscula, minúscula, número e símbolo.</small>
        <Field label="Chave de provisionamento" type="password" autoComplete="off" value={registrationKey} onChange={(event) => setRegistrationKey(event.target.value)} required />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" loading={loading}>Criar acesso</Button>
      </form>
    </section>
  )
}
