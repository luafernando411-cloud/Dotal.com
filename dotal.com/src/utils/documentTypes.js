export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024

export const documentTypes = [
  { id: 'identity', title: 'CPF / Documento de Identidade', description: 'Envie frente e verso em PDF ou imagem.', multiple: true, accept: '.pdf,image/jpeg,image/png,image/webp' },
  { id: 'photo', title: 'Foto 3x4 recente', description: 'Imagem nítida, frontal e com fundo neutro.', multiple: false, accept: 'image/jpeg,image/png,image/webp', imageOnly: true },
  { id: 'certificates', title: 'Certidões', description: 'Nascimento, casamento ou óbito, quando aplicável.', multiple: true, accept: '.pdf,image/jpeg,image/png,image/webp' },
  { id: 'employmentAct', title: 'Termo de Posse / Ato de Concessão', description: 'Documento de vínculo funcional ou benefício.', multiple: true, accept: '.pdf,image/jpeg,image/png,image/webp' },
  { id: 'pis', title: 'Comprovante PIS / PASEP', description: 'Comprovante de inscrição, quando disponível.', multiple: true, accept: '.pdf,image/jpeg,image/png,image/webp' },
  { id: 'residence', title: 'Comprovante de Residência', description: 'Conta de luz ou água emitida recentemente.', multiple: true, accept: '.pdf,image/jpeg,image/png,image/webp' },
]

export function validateDocument(file, { imageOnly = false } = {}) {
  if (file.size > MAX_DOCUMENT_SIZE) return 'O arquivo deve ter no máximo 10 MB.'
  const extension = file.name.toLowerCase().split('.').pop()
  const acceptedImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    || ['jpg', 'jpeg', 'png', 'webp'].includes(extension)
  const acceptedPdf = file.type === 'application/pdf' || extension === 'pdf'
  if (imageOnly && !acceptedImage) return 'Envie uma imagem JPG, PNG ou WEBP.'
  if (!imageOnly && !acceptedImage && !acceptedPdf) return 'Formato não aceito. Envie PDF, JPG, PNG ou WEBP.'
  return ''
}
