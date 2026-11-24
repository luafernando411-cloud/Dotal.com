import { useEffect, useMemo, useRef, useState } from 'react'
import { documentTypes, validateDocument } from '../../utils/documentTypes.js'
import { Icon } from './index.jsx'
import { DocumentPreviewModal } from './DocumentPreviewModal.jsx'

export function DocumentUploadStep({ attachments = {}, onChange }) {
  const [errors, setErrors] = useState({})
  const [previewFile, setPreviewFile] = useState(null)
  const inputRefs = useRef({})

  function selectFiles(document, incoming) {
    const files = Array.from(incoming)
    const failure = files.map((file) => validateDocument(file, document)).find(Boolean)
    if (failure) {
      setErrors((current) => ({ ...current, [document.id]: failure }))
      if (inputRefs.current[document.id]) inputRefs.current[document.id].value = ''
      return
    }
    const nextFiles = document.multiple
      ? [...(attachments[document.id] || []).filter((file) => !file.persistedOnly), ...files]
      : files.slice(0, 1)
    onChange({ ...attachments, [document.id]: nextFiles })
    setErrors((current) => ({ ...current, [document.id]: '' }))
    if (inputRefs.current[document.id]) inputRefs.current[document.id].value = ''
  }

  function removeFile(documentId, index) {
    const nextFiles = (attachments[documentId] || []).filter((_, fileIndex) => fileIndex !== index)
    onChange({ ...attachments, [documentId]: nextFiles })
  }

  return (
    <div className="document-upload-step" data-testid="document-upload-step">
      <div className="document-upload-intro"><span><Icon name="lock" size={17} /></span><p>Seus documentos são transmitidos com segurança. PDF e imagens JPG, PNG ou WEBP até 10 MB por arquivo.</p></div>
      <div className="document-upload-grid">
        {documentTypes.map((document) => {
          const files = attachments[document.id] || []
          return (
            <section className="document-upload-card" key={document.id} data-testid={`document-slot-${document.id}`}>
              <div className="document-upload-card-heading">
                <span className="document-slot-icon"><Icon name={document.imageOnly ? 'user' : 'file'} size={17} /></span>
                <span><strong>{document.title}</strong><small>{document.description}</small></span>
              </div>
              <input
                ref={(element) => { inputRefs.current[document.id] = element }}
                id={`upload-${document.id}`}
                type="file"
                accept={document.accept}
                multiple={document.multiple}
                className="document-file-input"
                onChange={(event) => selectFiles(document, event.target.files)}
                data-testid={`file-input-${document.id}`}
              />
              <label className="document-dropzone" htmlFor={`upload-${document.id}`}>
                <Icon name="download" size={18} /><span>{files.length ? 'Adicionar ou substituir arquivo' : 'Selecionar arquivo'}</span>
              </label>
              {errors[document.id] && <p className="form-error" role="alert">{errors[document.id]}</p>}
              <div className="document-file-list">
                {files.map((file, index) => (
                  <div className="document-file-row" key={`${file.name}-${index}`}>
                    {document.imageOnly && !file.persistedOnly && file.type.startsWith('image/')
                      ? <ImageThumbnail file={file} />
                      : <span className="document-file-icon"><Icon name="file" size={15} /></span>}
                    <span className="document-file-name"><strong>{file.name}</strong><small>{file.persistedOnly ? 'Selecione novamente para anexar após recarregar' : formatFileSize(file.size)}</small></span>
                    {!file.persistedOnly && <button type="button" className="document-file-action" onClick={() => setPreviewFile(file)} aria-label={`Pré-visualizar ${file.name}`}><Icon name="search" size={15} /></button>}
                    <button type="button" className="document-file-action remove" onClick={() => removeFile(document.id, index)} aria-label={`Remover ${file.name}`} data-testid={`remove-file-${document.id}-${index}`}><Icon name="close" size={15} /></button>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
      <p className="document-upload-note"><Icon name="info" size={14} />Os anexos são mantidos apenas durante esta sessão por segurança. O rascunho preserva os nomes dos arquivos.</p>
      {previewFile && <DocumentPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  )
}

function formatFileSize(size) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function ImageThumbnail({ file }) {
  const source = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(source), [source])
  return <img className="document-thumb" src={source} alt={`Miniatura de ${file.name}`} />
}
