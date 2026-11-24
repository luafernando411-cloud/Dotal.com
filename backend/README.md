# Censo Digital: API e banco

## Passo a passo

Execute dentro de `backend/`:

```bash
cp .env.example .env
```

Edite `.env`: defina uma senha para o PostgreSQL e use a mesma senha em `CENSUS_DATABASE_URL`. Gere uma chave JWT com:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copie o valor para `CENSUS_SECRET_KEY`. Em seguida:

```bash
docker compose up -d
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m app.create_admin
uvicorn app.main:app --reload
```

O Compose sobe somente PostgreSQL e Redis. O `init.sql` cria as tabelas e insere dez contatos fictícios de demonstração em `fake_contacts` no primeiro volume. O FastAPI cria tabelas ausentes e adiciona as colunas de autenticação necessárias em bancos existentes; contas administrativas antigas são migradas para `admins` no startup. Não reaplique `init.sql` em volumes existentes: a migração de esquema é feita pela API. Defina `CENSUS_ADMIN_REGISTRATION_KEY` com uma chave aleatória (por exemplo, `python -c "import secrets; print(secrets.token_urlsafe(32))"`) para habilitar `/admin/register`; sem ela, novos cadastros administrativos ficam desativados. `python -m app.create_admin` provisiona/atualiza uma conta administrativa por CLI. Não use senhas de exemplo em produção.

Configure `CENSUS_CORS_ORIGINS` com a origem exata do frontend. No Vite, defina `VITE_API_URL=http://localhost:8000`. O exemplo de React está em `/api-example`; o acesso administrativo fica em `/admin/login` e o cadastro com chave em `/admin/register`.

## Rotas e acesso

| Rota | Acesso |
|---|---|
| `GET /api/health` | Público |
| `POST /api/auth/register`, `POST /api/auth/login` | Público; cadastro e login por CPF |
| `GET /api/auth/me` | Usuário ou administrador autenticado |
| `POST /api/admin/auth/register` | Público, exige chave de provisionamento e senha forte |
| `POST /api/admin/auth/login` | Público; login administrativo somente por e-mail |
| `GET /api/admin/users`, `GET /api/admin/metrics`, `GET /api/admin/access-logs` | Somente admin; listagem paginada, métricas e auditoria |
| `PATCH /api/admin/users/{id}/status` | Somente admin; ativa ou bloqueia conta |
| `GET/POST /api/census` | Usuário autenticado; listagem limitada aos próprios registros |
| `POST /api/census/multipart` | Usuário autenticado |
| `GET/PATCH/DELETE /api/census/{id}` | Dono do registro ou admin |
| `GET /api/census/{id}/steps`, `PUT /api/census/{id}/steps/{step}` | Dono do registro ou admin |
| `GET /api/census/{id}/documents` | Dono do registro ou admin |
| `GET /api/admin/census`, `GET /api/admin/dashboard` | Somente admin |
| `PATCH /api/admin/census/{id}/status` | Somente admin |
| `PATCH /api/admin/census/{id}/steps/{step}/review` | Somente admin |

O usuário envia `cpf` (11 dígitos ou formato `000.000.000-00`), `fullName`, `email` e `password` no cadastro. A senha comum exige 8+ caracteres com letras e números; a administrativa exige 12+ caracteres, maiúscula, minúscula, número e símbolo. CPF é validado matematicamente e gravado apenas com dígitos. Administradores são guardados em tabela separada e usam rotas e token próprios. Os logins aplicam bloqueio progressivo por IP e identificador com Redis (fallback em memória), e eventos guardam somente hashes protegidos por chave de CPF/e-mail e IP. Listagens administrativas têm cache curto invalidado em alterações.

`/docs`, `/redoc` e `/openapi.json` ficam desativados quando `CENSUS_ENVIRONMENT=production`. O JWT expira em 30 minutos por padrão. O detector limita requisições por minuto e observa respostas repetidas `401`, `403` e `422`. Para conectar escala vertical, `CENSUS_SCALE_HOOK` pode apontar para um executável absoluto, confiável e de propriedade da operação; ele recebe apenas o motivo como argumento, sem shell, timeout de 5 segundos e cooldown global de 60 segundos. Sem hook configurado (padrão local), a API registra um incidente estruturado e continua com rate limit/bloqueio, sem executar comandos.

## Testes manuais

- CPF malformado ou matematicamente inválido no login/cadastro: deve responder `422`, sem consulta/gravação.
- Sem token em uma rota protegida: deve responder `401`.
- Com token de usuário em `/api/admin/dashboard`: deve responder `403`.
- Com token admin em `/api/admin/dashboard`: deve responder `200`.
- `POST /api/auth/register` recebe CPF, nome, e-mail e senha; não aceita `role`.
- `POST /api/admin/auth/register` sem a chave correta: deve responder `403`.
- Testes DTO: `cd backend && PYTHONPATH=. python -m unittest discover -s tests -v`.

O frontend guarda o JWT em `localStorage` neste exemplo. A API sempre valida o token e o tipo de conta; esconder a tela no React não substitui essa validação. Para uma aplicação com dados sensíveis, prefira cookies `HttpOnly`, `Secure` e `SameSite` após definir a estratégia de sessão.

Antes de publicar: use HTTPS, mantenha `.env` fora do Git, gere uma chave secreta aleatória, configure somente a origem real do frontend e não exponha as portas do PostgreSQL/Redis à internet.
