import { Icon } from '../ui/index.jsx'

const models = [
  { id: 'executive', title: 'Executiva e territorial', icon: 'chart', number: '01' },
  { id: 'observability', title: 'Observabilidade e performance', icon: 'activity', number: '02' },
  { id: 'quality', title: 'Qualidade e auditoria', icon: 'shield', number: '03' },
]

export function DashboardModelSwitcher({ value, onChange }) {
  return (
    <nav className="dashboard-model-switcher" aria-label="Modelos de dashboard" data-testid="dashboard-model-switcher">
      {models.map((model) => (
        <button
          type="button"
          key={model.id}
          className={`dashboard-model-option ${value === model.id ? 'active' : ''}`}
          onClick={() => onChange(model.id)}
          aria-pressed={value === model.id}
          data-testid={`dashboard-model-${model.id}`}
        >
          <span className="model-option-number">{model.number}</span>
          <Icon name={model.icon} size={17} />
          <span>{model.title}</span>
        </button>
      ))}
    </nav>
  )
}
