import { useState } from 'react'
import { BackHeader, Brand, Button, Icon, PageHeading } from '../components/ui/index.jsx'
import { OtpInput } from '../components/ui/OtpInput.jsx'
import { requestOtp, verifyOtp } from '../services/censusService.js'

export function OtpPage({ destination, method, onBack, onSuccess }) {
  const [code, setCode] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await verifyOtp(code.join(''))
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    try {
      await requestOtp(method, destination)
      setNotice('Um novo código foi enviado.')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="form-page otp-page">
      <BackHeader onBack={onBack} />
      <Brand compact />
      <div className="otp-mail-icon"><Icon name="lock" size={25} /></div>
      <PageHeading eyebrow="QUASE LÁ" title="Verifique seu acesso" description={<>Enviamos um código de 4 dígitos para<br /><strong>{destination}</strong></>} />
      <form onSubmit={handleSubmit}>
        <OtpInput value={code} onChange={setCode} />
        {error && <p className="form-error otp-error" role="alert">{error}</p>}
        {notice && <p className="success-note">{notice}</p>}
        <Button type="submit" loading={loading}>Confirmar <Icon name="arrowRight" size={18} /></Button>
      </form>
      <p className="resend-note">Não recebeu o código? <button type="button" className="text-link" onClick={resend}>Reenviar código</button></p>
      <p className="center-note">Você pode solicitar um novo código em instantes.</p>
    </section>
  )
}
