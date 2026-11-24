import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Erro inesperado na aplicação.', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell error-boundary-screen" role="alert">
          <div className="error-boundary-card">
            <h1>Não foi possível carregar esta tela</h1>
            <p>Seu rascunho continua salvo neste dispositivo. Tente carregar a aplicação novamente.</p>
            <button type="button" className="button button-primary" onClick={() => window.location.reload()}>Recarregar aplicação</button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
