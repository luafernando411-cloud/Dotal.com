import { useEffect, useMemo } from 'react'
import { Icon } from './index.jsx'

export function DocumentPreviewModal({ file, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  return (
    <div className="document-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="document-preview-modal" role="dialog" aria-modal="true" aria-labelledby="document-preview-title" data-testid="document-preview-modal">
        <header><span><Icon name="file" size={18} /><strong id="document-preview-title">{file.name}</strong></span><button type="button" onClick={onClose} aria-label="Fechar pré-visualização"><Icon name="close" size={18} /></button></header>
        <div className={`document-preview-body ${isPdf ? 'pdf-preview' : 'image-preview'}`}>
          {isPdf ? <iframe title={`Pré-visualização de ${file.name}`} src={url} /> : <img src={url} alt={`Pré-visualização de ${file.name}`} />}
        </div>
      </section>
    </div>
  )
}
