import { useCallback, useState } from 'react'
import { apiRequest, clearApiSession, loginApiUser, readApiSession, registerApiUser } from '../services/apiClient.js'

export function ApiExampleScreen({ onBack }) {
  const [session, setSession] = useState(readApiSession)
  const [registerMode, setRegisterMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [cpf, setCpf] = useState('')
  const [records, setRecords] = useState([])
  const [error, setError] = useState('')

  const loadRecords = useCallback(async () => {
    const result = await apiRequest('/api/census')
    setRecords(result.items)
  }, [])

  async function handleAccount(event) {
    event.preventDefault()
    setError('')
    try {
      if (registerMode) await registerApiUser({ cpf, fullName, email, password })
      const nextSession = await loginApiUser({ cpf, password })
      setSession(nextSession)
      setRegisterMode(false)
      await loadRecords()
    } catch (accountError) {
      setError(accountError.message)
    }
  }

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    try {
      await apiRequest('/api/census', {
        method: 'POST',
        body: { fullName, cpf, employmentStatus: 'Ativo' },
      })
      setFullName('')
      setCpf('')
      await loadRecords()
    } catch (createError) {
      setError(createError.message)
    }
  }

  function logout() {
    clearApiSession()
    setSession(null)
    setRecords([])
  }

  return (
    <main className="app-shell">
      <section className="form-page">
        <button type="button" className="text-link align-right" onClick={onBack}>Voltar</button>
        <div className="page-heading">
          <span className="eyebrow">EXEMPLO DE INTEGRAÇÃO</span>
          <h1>API do Censo</h1>
          <p>Cadastro e consulta de dados com token Bearer.</p>
        </div>

        {!session ? (
          <form className="form-stack" onSubmit={handleAccount}>
            {registerMode && <label>Nome completo<input required minLength="2" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}
            <label>CPF<input required value={cpf} onChange={(event) => setCpf(event.target.value)} /></label>
            {registerMode && <label>E-mail<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
            <label>Senha<input type="password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit">{registerMode ? 'Criar conta' : 'Entrar'}</button>
            <button type="button" onClick={() => setRegisterMode((current) => !current)}>
              {registerMode ? 'Já tenho uma conta' : 'Criar conta de usuário'}
            </button>
          </form>
        ) : (
          <>
            <p>Conta: {session.user.email} ({session.user.role})</p>
            <form className="form-stack" onSubmit={handleCreate}>
              <label>Nome completo<input required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
              <label>CPF<input required value={cpf} onChange={(event) => setCpf(event.target.value)} /></label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="submit">Cadastrar</button>
            </form>
            <h2>Meus registros</h2>
            <button type="button" onClick={() => loadRecords().catch((loadError) => setError(loadError.message))}>Atualizar lista</button>
            {records.length === 0 ? <p>Nenhum registro cadastrado.</p> : (
              <ul>{records.map((record) => <li key={record.id}>{record.fullName} — {record.protocol}</li>)}</ul>
            )}
            <button type="button" onClick={logout}>Sair</button>
          </>
        )}
      </section>
    </main>
  )
}
