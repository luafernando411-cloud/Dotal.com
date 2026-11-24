import { Brand, Button, Icon } from '../components/ui/index.jsx'

export function WelcomePage({ onLogin, onSignup, onAdmin, onApiExample }) {
  return (
    <section className="welcome-page">
      <header className="welcome-header"><Brand /></header>
      <div className="welcome-content">
        <div className="welcome-art" aria-hidden="true">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-card art-card-back"><span /><span /><span /></div>
          <div className="art-card art-card-main">
            <div className="art-icon"><Icon name="shield" size={37} /></div>
            <div className="art-lines"><span /><span /><span /></div>
            <div className="art-check"><Icon name="check" size={16} /></div>
          </div>
          <span className="art-spark spark-one" /><span className="art-spark spark-two" /><span className="art-spark spark-three" />
        </div>
        <div className="welcome-text">
          <span className="eyebrow">RECENSEAMENTO 2025</span>
          <h1>Uma gestão melhor começa com <span>você.</span></h1>
          <p>Atualize seus dados com segurança e ajude a construir um futuro mais justo para todos.</p>
        </div>
        <div className="welcome-actions">
          <Button onClick={onLogin}>Acessar Censo <Icon name="arrowRight" size={19} /></Button>
          <Button variant="navy" onClick={onSignup}>Primeiro Acesso</Button>
        </div>
        <div className="secure-note"><Icon name="lock" size={15} /><span>Ambiente seguro e protegido</span></div>
        <button type="button" className="welcome-admin-link" onClick={onAdmin}>Acesso do gestor</button>
        <button type="button" className="welcome-admin-link" onClick={onApiExample}>Exemplo da API</button>
      </div>
    </section>
  )
}
