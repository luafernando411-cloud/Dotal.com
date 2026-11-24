import { useState } from 'react'
import { BackHeader, Brand, Button, Icon, PageHeading } from '../components/ui/index.jsx'
import { requestOtp } from '../services/censusService.js'
import { useCensus } from '../context/useCensus.js'
import { onlyDigits } from '../utils/masks.js'

export function ContactPage({ onBack, onContinue }) {
  const [method, setMethod] = useState('sms')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { draft } = useCensus()
  const phoneDigits = onlyDigits(draft.phone || '')
  const phone = phoneDigits.length >= 4 ? `(**) *****-${phoneDigits.slice(-4)}` : '*** **** 1946'
  const email = draft.email ? `${draft.email.slice(0, 2)}***@${draft.email.split('@')[1] || 'email.com'}` : '****12@email.com'

  async function handleContinue() {
    const destination = method === 'sms' ? phone : email
    setLoading(true)
    setError('')
    try {
      await requestOtp(method, destination)
      onContinue(method, destination)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="form-page">
      <BackHeader onBack={onBack} />
      <Brand compact />
      <PageHeading eyebrow="VERIFICAÇÃO DE SEGURANÇA" title="Confirme seus dados" description="Escolha por onde deseja receber o código de verificação." />
      <div className="contact-options">
        <button type="button" className={`contact-card ${method === 'sms' ? 'selected' : ''}`} onClick={() => setMethod('sms')}>
          <span className="contact-icon"><Icon name="message" size={22} /></span>
          <span className="contact-copy"><strong>Via SMS</strong><small>{phone}</small></span>
          <span className="selection-check">{method === 'sms' && <Icon name="check" size={15} />}</span>
        </button>
        <button type="button" className={`contact-card ${method === 'email' ? 'selected' : ''}`} onClick={() => setMethod('email')}>
          <span className="contact-icon"><Icon name="mail" size={22} /></span>
          <span className="contact-copy"><strong>Via E-mail</strong><small>{email}</small></span>
          <span className="selection-check">{method === 'email' && <Icon name="check" size={15} />}</span>
        </button>
      </div>
      <div className="privacy-callout"><Icon name="lock" size={17} /><span>Seus dados de contato são mantidos em segurança.</span></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button onClick={handleContinue} loading={loading}>Solicitar Código (OTP) <span aria-hidden="true">→</span></Button>
      <p className="center-note">O código expira em 10 minutos.</p>
    </section>
  )
}
