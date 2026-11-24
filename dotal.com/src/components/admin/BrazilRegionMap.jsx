import { brazilRegions } from '../../utils/brazilRegions.js'

const shapes = [
  { name: 'Norte', path: 'M53 37 81 20 123 26 145 41 139 62 119 71 112 90 90 87 76 101 57 87 46 64Z', label: [93, 59] },
  { name: 'Nordeste', path: 'M145 41 172 43 187 55 206 57 218 70 208 87 195 92 188 108 171 105 158 89 139 91 119 71 139 62Z', label: [176, 75] },
  { name: 'Centro-Oeste', path: 'M90 87 112 90 119 71 139 91 158 89 171 105 166 124 148 132 140 151 121 152 108 137 90 142 81 122 67 113Z', label: [126, 116] },
  { name: 'Sudeste', path: 'M158 89 171 105 188 108 195 119 187 135 176 144 172 162 157 167 144 158 140 151 148 132 166 124 171 105Z', label: [168, 137] },
  { name: 'Sul', path: 'M121 152 140 151 144 158 157 167 151 186 139 199 125 210 113 201 103 184 108 166Z', label: [131, 179] },
]

export function BrazilRegionMap({ state = '', testId = 'brazil-region-map' }) {
  const region = brazilRegions.find((item) => item.states.includes(state))?.name || ''
  return (
    <div className="brazil-region-card" data-testid={testId}>
      <div className="brazil-region-card-heading"><span>Localização no Brasil</span><strong>{state || '—'}{region ? ` · ${region}` : ''}</strong></div>
      <svg viewBox="0 0 235 220" role="img" aria-label={region ? `Estado ${state}, região ${region}` : 'Mapa das regiões brasileiras'}>
        {shapes.map((shape) => (
          <g key={shape.name} className={region === shape.name ? 'active-region' : ''}>
            <path d={shape.path} />
            <text x={shape.label[0]} y={shape.label[1]}>{shape.name === 'Centro-Oeste' ? 'CO' : shape.name === 'Nordeste' ? 'NE' : shape.name.slice(0, 2).toUpperCase()}</text>
          </g>
        ))}
      </svg>
      {region && <span className="brazil-region-badge">{state} · {region}</span>}
      {!region && <small className="brazil-region-empty">Informe seu estado ou CEP para destacar a região.</small>}
    </div>
  )
}
