import { useEffect, useState } from 'react'
import { CensusProvider } from './context/CensusContext.jsx'
import { useCensus } from './context/useCensus.js'
import { WelcomeScreen } from './pages/WelcomeScreen.jsx'
import { LoginScreen } from './pages/LoginScreen.jsx'
import { RegisterScreen } from './pages/RegisterScreen.jsx'
import { ContactVerificationScreen } from './pages/ContactVerificationScreen.jsx'
import { OtpScreen } from './pages/OtpScreen.jsx'
import { CensusFormScreen } from './pages/CensusFormScreen.jsx'
import { SuccessScreen } from './pages/SuccessScreen.jsx'
import { Icon } from './components/ui/index.jsx'
import { AdminDashboardScreen } from './pages/AdminDashboardScreen.jsx'
import { AdminLoginScreen } from './pages/AdminLoginScreen.jsx'
import { AdminRegisterScreen } from './pages/AdminRegisterScreen.jsx'
import { ApiExampleScreen } from './pages/ApiExampleScreen.jsx'
import { apiRequest, clearApiSession, readApiSession } from './services/apiClient.js'
import './App.css'

function isAdminPath(path) {
  return path === '/admin' || path === '/admin/'
}

function isAdminAuthPath(path) {
  return path === '/admin/login' || path === '/admin/register'
}

function CensusApp() {
  const [path, setPath] = useState(() => window.location.pathname)
  const [session, setSession] = useState(readApiSession)
  const [sessionStatus, setSessionStatus] = useState(() => {
    if (!isAdminPath(window.location.pathname)) return 'idle'
    return readApiSession() ? 'checking' : 'anonymous'
  })
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0)
  const [contactMethod, setContactMethod] = useState('sms')
  const [contactDestination, setContactDestination] = useState('')
  const [protocol, setProtocol] = useState('')
  const { resetDraft, theme, setTheme, page, setPage } = useCensus()

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = window.location.pathname
      setPath(nextPath)
      setSessionStatus(isAdminPath(nextPath) ? (readApiSession() ? 'checking' : 'anonymous') : 'idle')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!isAdminPath(path) || !session?.accessToken) return undefined

    let active = true
    async function verifySession() {
      try {
        const user = await apiRequest('/api/auth/me')
        if (active) {
          setSession((current) => ({ ...current, user }))
          setSessionStatus('valid')
        }
      } catch (error) {
        if (active) {
          if (error.status === 401) {
            clearApiSession()
            setSession(null)
            setSessionStatus('anonymous')
          } else {
            setSessionStatus('error')
          }
        }
      }
    }
    verifySession()
    const timer = window.setInterval(verifySession, 60_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [path, session?.accessToken, authCheckAttempt])

  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
    setSessionStatus(isAdminPath(nextPath) ? (readApiSession() ? 'checking' : 'anonymous') : 'idle')
  }

  const changeTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
  }

  const startOver = () => {
    resetDraft()
    setPage('welcome')
    navigate('/')
  }

  if (path === '/api-example') {
    return <ApiExampleScreen onBack={() => navigate('/')} />
  }

  if (isAdminAuthPath(path)) {
    if (path === '/admin/register') {
      return (
        <main className="app-shell" data-theme={theme}>
          <AdminRegisterScreen onBack={() => navigate('/admin/login')} onSuccess={() => navigate('/admin/login')} />
        </main>
      )
    }
    return (
      <main className="app-shell" data-theme={theme}>
        <AdminLoginScreen
          onBack={() => navigate('/')}
          onRegister={() => navigate('/admin/register')}
          onSuccess={(nextSession) => {
            setSession(nextSession)
            navigate('/admin')
          }}
        />
      </main>
    )
  }

  if (isAdminPath(path)) {
    if (sessionStatus === 'checking') {
      return <main className="app-shell" data-theme={theme}><p role="status">Verificando acesso...</p></main>
    }
    if (sessionStatus === 'error') {
      return (
        <main className="app-shell" data-theme={theme}>
          <section className="form-page">
            <p role="alert">Não foi possível verificar sua sessão.</p>
            <button type="button" onClick={() => setAuthCheckAttempt((attempt) => attempt + 1)}>Tentar novamente</button>
            <button type="button" onClick={() => navigate('/')}>Voltar ao início</button>
          </section>
        </main>
      )
    }
    if (!session) {
      return (
        <main className="app-shell" data-theme={theme}>
          <AdminLoginScreen
            onBack={() => navigate('/')}
            onRegister={() => navigate('/admin/register')}
            onSuccess={(nextSession) => {
              setSession(nextSession)
              navigate('/admin')
            }}
          />
        </main>
      )
    }
    if (session.user.role !== 'admin') {
      return (
        <main className="app-shell" data-theme={theme}>
          <section className="form-page">
            <div className="page-heading"><span className="eyebrow">ACESSO RESTRITO</span><h1>Acesso negado</h1><p>Sua conta não tem permissão para abrir o painel.</p></div>
            <button type="button" onClick={() => { clearApiSession(); setSession(null); navigate('/') }}>Sair</button>
          </section>
        </main>
      )
    }
    return (
      <AdminDashboardScreen
        theme={theme}
        onThemeChange={changeTheme}
        onReturn={() => navigate('/')}
        onLogout={() => { clearApiSession(); setSession(null); navigate('/') }}
      />
    )
  }

  return (
    <main className="app-shell" data-theme={theme}>
      {page === 'welcome' && (
        <WelcomeScreen
          onLogin={() => setPage('login')}
          onSignup={() => setPage('signup')}
          onAdmin={() => navigate('/admin/login')}
          onApiExample={() => navigate('/api-example')}
        />
      )}
      {page === 'login' && (
        <LoginScreen onBack={() => setPage('welcome')} onSignup={() => setPage('signup')} onSuccess={() => setPage('census')} />
      )}
      {page === 'signup' && (
        <RegisterScreen onBack={() => setPage('welcome')} onContinue={() => setPage('contact')} />
      )}
      {page === 'contact' && (
        <ContactVerificationScreen
          onBack={() => setPage('signup')}
          onContinue={(method, destination) => {
            setContactMethod(method)
            setContactDestination(destination)
            setPage('otp')
          }}
        />
      )}
      {page === 'otp' && (
        <OtpScreen destination={contactDestination} method={contactMethod} onBack={() => setPage('contact')} onSuccess={() => setPage('census')} />
      )}
      {page === 'census' && <CensusFormScreen onSuccess={(value) => { setProtocol(value); setPage('success') }} />}
      {page === 'success' && <SuccessScreen protocol={protocol} onHome={startOver} />}
      <footer className="app-footer">
        <button type="button" className="theme-toggle footer-theme-toggle" onClick={changeTheme} aria-label={`Ativar tema ${theme === 'light' ? 'escuro' : 'claro'}`}>
          <Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />
          <span>{theme === 'light' ? 'Escuro' : 'Claro'}</span>
        </button>
        <span>© 2025 Censo Digital</span>
        <span className="footer-dot" />
        <span>Seus dados protegidos</span>
      </footer>
      <span className="sr-only" aria-live="polite">Etapa atual: {page}</span>
    </main>
  )
}

export default function App() {
  return (
    <CensusProvider>
      <CensusApp />
    </CensusProvider>
  )
}
