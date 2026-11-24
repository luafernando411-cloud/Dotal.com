import { Icon } from './index.jsx'

export function HeaderNav({ onBack, onThemeChange, theme, title = 'Censo Digital' }) {
  return (
    <header className="census-header">
      {onBack
        ? <button type="button" className="icon-button" onClick={onBack} aria-label="Voltar"><Icon name="arrow" size={18} /></button>
        : <div className="census-brand"><span className="census-brand-mark"><Icon name="shield" size={21} /></span><span>{title}</span></div>}
      <button type="button" className="theme-toggle" onClick={onThemeChange} aria-label={`Ativar tema ${theme === 'light' ? 'escuro' : 'claro'}`}>
        <Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} />
        <span>{theme === 'light' ? 'Escuro' : 'Claro'}</span>
      </button>
    </header>
  )
}
