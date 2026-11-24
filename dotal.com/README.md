# Censo Digital

Frontend para recenseamento e gestão, construído com React, Vite e Tailwind CSS.

## Executar localmente

```sh
npm install
npm run dev
```

Para validar a versão de produção:

```sh
npm run build
npm run preview
```

## Fluxo da aplicação

O aplicativo inclui boas-vindas, acesso, primeiro cadastro, validação OTP, formulário em quatro etapas e confirmação com protocolo. O rascunho do censo e a preferência de tema são salvos no `localStorage`.

O painel do gestor está disponível em `/admin` e oferece três modelos selecionáveis: visão executiva/territorial, observabilidade/performance e qualidade/auditoria. A seleção do modelo é persistida no `localStorage`; os filtros globais afetam os indicadores, gráficos, mapa, filas e exportação CSV. A visão executiva abre o mapa de Acesso a Oportunidades do IPEA, com opção de alternar para o mapa regional filtrável do Censo. O fluxo do recenseado permanece em `/`.

O formulário inclui validação de CPF, etapas de vínculo e endereço, consulta mockada de CEP com preenchimento manual alternativo, mapa regional, dependentes e anexos com pré-visualização e validação de formato/tamanho. Os dados cadastrais e nomes dos anexos integram o rascunho local; por segurança, arquivos binários devem ser selecionados novamente após recarregar a página. O envio prepara um `FormData` em `buildCensusFormData` para integrar com uma API `multipart/form-data`.

As operações em `src/services/` são mock assíncronos, prontos para conexão REST. A consulta de CEP usa dados demonstrativos e uma inferência regional aproximada, podendo ser substituída pelo provedor oficial. No fluxo de demonstração, qualquer credencial não vazia e qualquer código OTP de quatro dígitos são aceitos.
