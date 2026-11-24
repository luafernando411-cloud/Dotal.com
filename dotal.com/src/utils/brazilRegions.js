export const brazilRegions = [
  { name: 'Norte', states: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'] },
  { name: 'Nordeste', states: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'] },
  { name: 'Centro-Oeste', states: ['DF', 'GO', 'MT', 'MS'] },
  { name: 'Sudeste', states: ['ES', 'MG', 'RJ', 'SP'] },
  { name: 'Sul', states: ['PR', 'RS', 'SC'] },
]

export const brazilStates = [
  ['AC', 'Acre', 'Norte'], ['AL', 'Alagoas', 'Nordeste'], ['AP', 'Amapá', 'Norte'],
  ['AM', 'Amazonas', 'Norte'], ['BA', 'Bahia', 'Nordeste'], ['CE', 'Ceará', 'Nordeste'],
  ['DF', 'Distrito Federal', 'Centro-Oeste'], ['ES', 'Espírito Santo', 'Sudeste'],
  ['GO', 'Goiás', 'Centro-Oeste'], ['MA', 'Maranhão', 'Nordeste'], ['MT', 'Mato Grosso', 'Centro-Oeste'],
  ['MS', 'Mato Grosso do Sul', 'Centro-Oeste'], ['MG', 'Minas Gerais', 'Sudeste'],
  ['PA', 'Pará', 'Norte'], ['PB', 'Paraíba', 'Nordeste'], ['PR', 'Paraná', 'Sul'],
  ['PE', 'Pernambuco', 'Nordeste'], ['PI', 'Piauí', 'Nordeste'], ['RJ', 'Rio de Janeiro', 'Sudeste'],
  ['RN', 'Rio Grande do Norte', 'Nordeste'], ['RS', 'Rio Grande do Sul', 'Sul'],
  ['RO', 'Rondônia', 'Norte'], ['RR', 'Roraima', 'Norte'], ['SC', 'Santa Catarina', 'Sul'],
  ['SP', 'São Paulo', 'Sudeste'], ['SE', 'Sergipe', 'Nordeste'], ['TO', 'Tocantins', 'Norte'],
].map(([uf, name, region]) => ({ uf, name, region }))

export function getRegionByState(uf) {
  return brazilStates.find((state) => state.uf === uf.toUpperCase())?.region || ''
}

export function getStateByCep(cep) {
  const digits = cep.replace(/\D/g, '')
  const prefix = Number(digits.slice(0, 2))
  const prefix3 = Number(digits.slice(0, 3))
  if (prefix >= 1 && prefix <= 19) return 'SP'
  if (prefix >= 20 && prefix <= 28) return 'RJ'
  if (prefix === 29) return 'ES'
  if (prefix >= 30 && prefix <= 39) return 'MG'
  if (prefix >= 40 && prefix <= 48) return 'BA'
  if (prefix === 49) return 'SE'
  if (prefix >= 50 && prefix <= 56) return 'PE'
  if (prefix === 57) return 'AL'
  if (prefix === 58) return 'PB'
  if (prefix === 59) return 'RN'
  if (prefix >= 60 && prefix <= 63) return 'CE'
  if (prefix === 64) return 'PI'
  if (prefix === 65) return 'MA'
  if (prefix >= 66 && prefix <= 68) {
    if (prefix3 === 689) return 'AP'
    return 'PA'
  }
  if (prefix === 69) return prefix3 === 693 ? 'RR' : prefix3 === 699 ? 'AC' : 'AM'
  if (prefix >= 70 && prefix <= 73) return 'DF'
  if (prefix >= 74 && prefix <= 76) return prefix3 >= 768 ? 'RO' : 'GO'
  if (prefix === 77) return 'TO'
  if (prefix === 78) return 'MT'
  if (prefix === 79) return 'MS'
  if (prefix >= 80 && prefix <= 87) return 'PR'
  if (prefix >= 88 && prefix <= 89) return 'SC'
  if (prefix >= 90 && prefix <= 99) return 'RS'
  return ''
}
