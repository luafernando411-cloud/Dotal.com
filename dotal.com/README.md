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

O painel do gestor tem acesso dedicado em `/admin/login` (e cadastro provisionado em `/admin/register`) e oferece visão executiva, segurança/acessos e qualidade/auditoria. O fluxo do recenseado permanece em `/`.

O formulário inclui validação de CPF, etapas de vínculo e endereço, consulta de CEP com preenchimento manual alternativo, dependentes e anexos com pré-visualização e validação de formato/tamanho. O login, cadastro e envio de censo usam a API configurada por `VITE_API_URL`.

## Pipeline E2E Playwright

A pipeline sobe uma API isolada em SQLite e o Vite, descobre rotas/estados SPA, executa fluxos de autenticação e autorização, audita chamadas HTTP e produz evidências e relatórios em `artifacts/`.

```sh
npm ci
python -m pip install -r ../backend/requirements.txt
npx playwright install chromium
npm run test:pipeline
```

`npm run test:e2e` executa os testes sem limpar o banco E2E; `npm run test:e2e:ui` abre a interface do Playwright. Para usar serviços externos, configure `BASE_URL`, `API_BASE_URL`, `E2E_START_SERVERS=false` e `E2E_ADMIN_REGISTRATION_KEY`; use sempre um backend isolado e descartável, pois os cenários gravam usuários e tentativas de login.

Saídas principais: `artifacts/map-routes.json`, `artifacts/html-report/` (HTML interativo nativo), `artifacts/reports/e2e-report.{html,json,md}`, `artifacts/videos/`, `artifacts/screenshots/` e `artifacts/traces/`. O interceptor registra método, URL, status, latência e headers de cache/rate-limit; senhas, tokens, e-mails e CPFs nunca são gravados como valores. Respostas `5xx` e falhas de transporte reprovam o teste.

O workflow `.github/workflows/e2e.yml` executa a mesma pipeline em pull requests e pushes.
