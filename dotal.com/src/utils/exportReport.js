const columns = [
  ['protocol', 'Protocolo'],
  ['name', 'Nome'],
  ['cpf', 'CPF'],
  ['category', 'Categoria'],
  ['city', 'Cidade'],
  ['state', 'UF'],
  ['region', 'Região'],
  ['status', 'Status'],
  ['updatedAt', 'Atualizado em'],
]

function escapeCsv(value) {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export function exportReport(records) {
  const rows = [
    columns.map(([, label]) => escapeCsv(label)).join(','),
    ...records.map((record) => columns.map(([key]) => escapeCsv(record[key])).join(',')),
  ]
  const csv = `\uFEFF${rows.join('\r\n')}`
  const file = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = `censo-registros-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
