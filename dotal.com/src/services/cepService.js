import { brazilStates, getStateByCep } from '../utils/brazilRegions.js'
import { onlyDigits } from '../utils/masks.js'

const mockedAddresses = {
  '01001000': { street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo', state: 'SP' },
  '20040002': { street: 'Rua da Assembleia', neighborhood: 'Centro', city: 'Rio de Janeiro', state: 'RJ' },
  '30140071': { street: 'Avenida Álvares Cabral', neighborhood: 'Lourdes', city: 'Belo Horizonte', state: 'MG' },
  '40010000': { street: 'Praça da Sé', neighborhood: 'Centro', city: 'Salvador', state: 'BA' },
  '60060000': { street: 'Avenida Beira Mar', neighborhood: 'Meireles', city: 'Fortaleza', state: 'CE' },
  '70040010': { street: 'Esplanada dos Ministérios', neighborhood: 'Zona Cívico-Administrativa', city: 'Brasília', state: 'DF' },
  '80010000': { street: 'Rua XV de Novembro', neighborhood: 'Centro', city: 'Curitiba', state: 'PR' },
  '90010000': { street: 'Rua dos Andradas', neighborhood: 'Centro Histórico', city: 'Porto Alegre', state: 'RS' },
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function lookupCep(value) {
  const cep = onlyDigits(value)
  if (cep.length !== 8) throw new Error('Digite um CEP com 8 números.')
  await wait(380)

  const known = mockedAddresses[cep]
  const uf = known?.state || getStateByCep(cep)
  if (!uf) throw new Error('Não encontramos este CEP. Você pode preencher o endereço manualmente.')
  const state = brazilStates.find((item) => item.uf === uf)
  return {
    cep,
    street: known?.street || '',
    neighborhood: known?.neighborhood || '',
    city: known?.city || '',
    state: uf,
    stateName: state.name,
    region: state.region,
    source: known ? 'mock' : 'range',
  }
}
