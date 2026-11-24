import { Icon } from './index.jsx'

export function SelectionCard({ selected, icon, title, description, onClick, testId }) {
  return (
    <button type="button" className={`contact-card ${selected ? 'selected' : ''}`} onClick={onClick} data-testid={testId}>
      <span className="contact-icon"><Icon name={icon} size={22} /></span>
      <span className="contact-copy"><strong>{title}</strong><small>{description}</small></span>
      <span className="selection-check">{selected && <Icon name="check" size={15} />}</span>
    </button>
  )
}
