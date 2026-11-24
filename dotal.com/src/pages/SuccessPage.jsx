import { useState } from 'react'
import { Button, Icon } from '../components/ui/index.jsx'

export function SuccessPage({ protocol, onHome }) {
  const [notice, setNotice] = useState('')

  async function copyProtocol() {
    try {
      await navigator.clipboard.writeText(protocol || '')
      setNotice('Protocolo copiado.')
    } catch (error) {
      console.error('Não foi possível copiar o protocolo.', error)
      setNotice('Não foi possível copiar. Selecione o protocolo para copiá-lo.')
    }
  }

  return (
    <section className="success-page success-screen" data-testid="success-screen">
      <div className="success-illustration" aria-hidden="true">
        <span className="success-confetti confetti-one" /><span className="success-confetti confetti-two" />
        <span className="success-confetti confetti-three" /><span className="success-confetti confetti-four" />
        <div className="success-ring"><div className="success-circle"><Icon name="check" size={53} /></div></div>
      </div>
      <span className="eyebrow success-eyebrow">RECENSEAMENTO CONCLUÍDO</span>
      <h1>Tudo certo por aqui!</h1>
      <p className="success-description">Suas informações foram enviadas com sucesso. Obrigado por fazer parte dessa transformação.</p>
      <div className="protocol-card">
        <span>NÚMERO DE PROTOCOLO</span>
        <strong className="protocol-copy-value">{protocol}</strong>
        <small>Guarde este número para acompanhar seu cadastro.</small>
        <div className="receipt-actions">
          <button type="button" className="receipt-action" onClick={copyProtocol} data-testid="copy-protocol"><Icon name="file" size={14} />Copiar protocolo</button>
          <button type="button" className="receipt-action" onClick={() => window.print()} data-testid="print-receipt"><Icon name="download" size={14} />Imprimir comprovante</button>
        </div>
      </div>
      {notice && <p className="success-note" role="status">{notice}</p>}
      <Button onClick={onHome}>Voltar ao Início <Icon name="arrowRight" size={18} /></Button>
      <p className="success-support">Precisa de ajuda? <a href="mailto:suporte@censodigital.gov.br">Fale com nosso suporte</a></p>
    </section>
  )
}
