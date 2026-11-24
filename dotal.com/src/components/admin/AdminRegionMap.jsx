import { useState } from 'react'
import { Icon } from '../ui/index.jsx'

const IPEA_MAP_URL = 'https://www.ipea.gov.br/mapaacessibilidade/'
const IPEA_REFERENCE_URL = 'https://www.ipea.gov.br/acessooportunidades/mapa/'

const regionShapes = [
  {
    name: 'Norte',
    color: '#b7e9f8',
    path: 'M87 72 122 42 184 40 211 26 257 42 285 61 277 91 250 104 229 133 194 127 177 145 148 131 119 136 98 114 76 99Z',
    label: [173, 86],
  },
  {
    name: 'Nordeste',
    color: '#80d3f0',
    path: 'M285 61 322 70 339 91 371 98 390 116 380 139 360 146 351 168 324 168 309 148 285 152 276 128 250 104 277 91Z',
    label: [338, 123],
  },
  {
    name: 'Centro-Oeste',
    color: '#45b9e5',
    path: 'M148 131 177 145 194 127 229 133 250 104 276 128 285 152 309 148 324 168 310 195 286 205 276 232 246 235 227 210 198 219 183 197 154 206 140 181 121 168 130 147Z',
    label: [218, 178],
  },
  {
    name: 'Sudeste',
    color: '#3b83b9',
    path: 'M285 152 309 148 324 168 351 168 360 184 348 205 332 218 325 243 304 254 284 243 276 232 286 205 310 195 324 168Z',
    label: [319, 206],
  },
  {
    name: 'Sul',
    color: '#3b4978',
    path: 'M246 235 276 232 284 243 304 254 297 280 281 300 260 318 242 307 224 285 230 260Z',
    label: [264, 278],
  },
]

export function AdminRegionMap({ counts, selectedRegion, onSelect }) {
  const [mapView, setMapView] = useState('ipea')
  const total = regionShapes.reduce((sum, { name }) => sum + (counts[name] || 0), 0)

  return (
    <div className="admin-map-module" data-testid="admin-map-module">
      <div className="admin-map-toolbar">
        <div className="admin-map-view-switch" role="group" aria-label="Tipo de mapa">
          <button type="button" className={mapView === 'ipea' ? 'active' : ''} onClick={() => setMapView('ipea')} aria-pressed={mapView === 'ipea'} data-testid="map-view-ipea">
            <Icon name="building" size={14} /> Mapa do IPEA
          </button>
          <button type="button" className={mapView === 'census' ? 'active' : ''} onClick={() => setMapView('census')} aria-pressed={mapView === 'census'} data-testid="map-view-census">
            <Icon name="users" size={14} /> Regiões do Censo
          </button>
        </div>
        {mapView === 'ipea' && <a className="ipea-map-source" href={IPEA_REFERENCE_URL} target="_blank" rel="noreferrer">Abrir mapa do IPEA <Icon name="arrowRight" size={13} /></a>}
      </div>
      {mapView === 'ipea' ? (
        <div className="ipea-map-frame-wrap">
          <iframe
            className="ipea-map-frame"
            src={IPEA_MAP_URL}
            title="Mapa Acesso a Oportunidades, do IPEA"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            allow="fullscreen"
            data-testid="ipea-map-frame"
          />
          <p className="ipea-map-note"><Icon name="info" size={13} />Mapa externo do IPEA; seus indicadores não representam nem filtram os registros do Censo.</p>
        </div>
      ) : (
        <div className="region-map-layout">
          <div className="region-map-canvas">
            <svg className="brazil-map" viewBox="0 0 430 345" role="img" aria-labelledby="region-map-title">
              <title id="region-map-title">Mapa interativo de recenseados por macrorregião</title>
              <defs>
                <filter id="mapShadow" x="-20%" y="-20%" width="140%" height="150%">
                  <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#25395f" floodOpacity=".13" />
                </filter>
              </defs>
              <g filter="url(#mapShadow)">
                {regionShapes.map((region) => {
                  const isSelected = selectedRegion === region.name
                  return (
                    <g
                      key={region.name}
                      role="button"
                      tabIndex={0}
                      aria-label={`${region.name}: ${counts[region.name] || 0} recenseados`}
                      aria-pressed={isSelected}
                      className={`map-region ${isSelected ? 'map-region-selected' : ''}`}
                      onClick={() => onSelect(isSelected ? '' : region.name)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSelect(isSelected ? '' : region.name)
                        }
                      }}
                    >
                      <path d={region.path} fill={region.color} />
                      <text x={region.label[0]} y={region.label[1]} className={region.name === 'Norte' || region.name === 'Nordeste' ? 'map-label-dark' : ''}>{counts[region.name] || 0}</text>
                      <title>{region.name}: {counts[region.name] || 0} recenseados</title>
                    </g>
                  )
                })}
              </g>
            </svg>
            <p className="map-hint"><Icon name="activity" size={14} /> Selecione uma região para filtrar os registros</p>
          </div>
          <div className="region-legend" aria-label="Registros por região">
            {regionShapes.map(({ name, color }) => {
              const count = counts[name] || 0
              const percent = total ? Math.round((count / total) * 100) : 0
              return (
                <button
                  className={`region-legend-row ${selectedRegion === name ? 'active' : ''}`}
                  type="button"
                  key={name}
                  onClick={() => onSelect(selectedRegion === name ? '' : name)}
                  data-testid={`region-filter-${name.toLowerCase().replaceAll(' ', '-')}`}
                >
                  <span className="region-color" style={{ backgroundColor: color }} />
                  <span className="region-legend-copy"><strong>{name}</strong><small>{count.toLocaleString('pt-BR')} registros</small></span>
                  <span className="region-legend-value"><strong>{count}</strong><small>{percent}%</small></span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
