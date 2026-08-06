# SmartNutri

Sistema web multiempresa para substituir a planilha de controle de pacientes, planos, ciclos de consultas e pagamentos de uma clínica de nutrição. Pensado primeiro para o nutricionista que atende sozinho (sem clínica com nome próprio), mas pronto para clínicas multiprofissionais — a identidade exibida no app é sempre a do profissional, nunca um nome de tenant fixo. Consultas, cobranças e pagamentos são entidades independentes e relacionadas — não colunas fixas de planilha — com histórico completo e autorização por perfil aplicada no backend.

O plano completo (modelagem, rotas, decisões de arquitetura, etapas de entrega) está registrado no histórico do projeto. Este README cobre apenas como rodar o que já existe.

## Stack

- **Frontend**: Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui + React Hook Form + Zod + Recharts
- **Backend**: NestJS + TypeScript + Prisma ORM + PostgreSQL + Swagger
- **Auth**: JWT (access token curto + refresh token httpOnly rotacionado, com detecção de reuso) + RBAC por perfil (`ADMIN`, `NUTRITIONIST`, `RECEPTION`)
- **Storage**: MinIO (S3-compatible) via `@aws-sdk/client-s3` — só chaves de objeto no banco, leitura sempre por URL pré-assinada de curta duração, nunca URL pública permanente
- **Infra local**: Docker Compose (Postgres + MinIO + backend + frontend)

## Rodando localmente com Docker (recomendado)

```bash
docker compose up -d --build
```

Isso sobe:

| Serviço | Porta no host | Descrição |
| --- | --- | --- |
| frontend | http://localhost:3020 | Next.js dev server |
| backend | http://localhost:3021 | API NestJS (Swagger em `/api/docs`) |
| postgres | localhost:5440 | Banco de dados |
| minio | http://localhost:9020 (API) / http://localhost:9021 (console) | Storage S3-compatible — fotos de evolução, foto/logo do profissional (login `clinica_minio` / `clinica_minio_password`) |

As portas foram deslocadas dos valores padrão (3000/3001/5432/9000/9001) para não colidir com outros projetos já rodando na máquina.

Depois dos containers subirem, rode a migração e o seed dentro do container do backend:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

### Credenciais de demonstração (ambiente local apenas)

Todas com a senha `Demo@123456`:

| Perfil | E-mail |
| --- | --- |
| Administrador(a) | admin@clinicademo.com.br |
| Nutricionista | nutricionista@clinicademo.com.br |
| Recepção | recepcao@clinicademo.com.br |

### Observação — hot reload no Windows

`nest start --watch` e o Turbopack do Next.js usam observação de arquivos (inotify) que nem sempre propaga corretamente através de bind mounts do Docker Desktop no Windows/WSL2. Se uma alteração de código não recarregar sozinha, rode:

```bash
docker compose restart backend   # ou frontend
```

A primeira compilação de cada rota/módulo também costuma ser mais lenta nesse ambiente (bind mount lento) — chamadas subsequentes usam o cache e ficam rápidas.

Em casos raros (observado com rotas dinâmicas aninhadas do Next.js retornando 404 mesmo existindo), `restart` sozinho não limpa o cache do Turbopack persistido no container. Se isso acontecer, recrie o container do zero:

```bash
docker compose stop frontend && docker compose rm -f frontend && docker compose up -d frontend
```

### Observação — Prisma CLI e `localhost` no Windows

Ao rodar comandos do Prisma (`migrate`, `studio`) **fora do Docker**, use `127.0.0.1` em vez de `localhost` na `DATABASE_URL`. Em alguns ambientes Windows/WSL2 o schema-engine do Prisma tenta resolver `localhost` via IPv6 e falha ao conectar no Postgres publicado pelo Docker (`P1001: Can't reach database server`). Os `.env.example` já usam `127.0.0.1` por esse motivo.

### Observação — build lento / travado no Windows

O build (`docker compose up --build`) pode ficar extremamente lento ou parecer travado se o `node_modules` de `backend/` ou `frontend/` estiver grande — sem `.dockerignore`, o Docker reenvia a pasta inteira como contexto de build a cada `npm install`/dependência nova. Os dois projetos já têm `.dockerignore` (excluindo `node_modules`, `.next`, `dist`), então builds normais são rápidos; se ainda assim travar, rode `docker buildx prune --force` para cancelar builds presos e liberar recursos antes de tentar de novo.

## Rodando sem Docker

Cada pasta (`backend/`, `frontend/`) é um projeto Node independente com seu próprio `.env.example`. Requer um Postgres rodando localmente (ajuste `DATABASE_URL` conforme sua porta).

```bash
# backend
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev   # http://localhost:3001

# frontend (em outro terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev -- -p 3010   # ajuste NEXT_PUBLIC_API_URL em .env.local se mudar a porta do backend
```

## Estrutura

```
backend/    API NestJS + Prisma (schema.prisma tem o modelo de domínio completo)
frontend/   Next.js App Router
docker-compose.yml
```

## Rotas da API

Documentação interativa completa (com schemas e exemplos) em `/api/docs` (Swagger). Resumo:

| Módulo | Rota | Quem acessa |
| --- | --- | --- |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` (públicas) | — |
| Auth | `GET /auth/me` | qualquer perfil autenticado |
| Users | `GET/POST /users`, `PATCH /users/:id/role`, `DELETE /users/:id` | ADMIN |
| Users | `GET /users/nutritionists` (lista enxuta p/ selects) | qualquer perfil |
| Clinics | `GET /clinics/me` | qualquer perfil; `PATCH /clinics/me` | ADMIN |
| Patients | `GET/POST /patients`, `GET/PATCH /patients/:id` | ADMIN, NUTRITIONIST, RECEPTION |
| Patients | `PATCH /patients/:id/status` | ADMIN, RECEPTION |
| Patients | `DELETE /patients/:id` (arquivar — exclusão lógica) | ADMIN |
| Plans | `GET /plans`, `GET /plans/:id` | qualquer perfil (RECEPTION só enxerga planos ativos) |
| Plans | `POST/PATCH /plans/:id`, `PATCH /plans/:id/status`, `DELETE /plans/:id` | ADMIN |
| Professional Profile | `GET /professional-profile/me` | qualquer perfil autenticado |
| Professional Profile | `PATCH /professional-profile/me`, `POST /professional-profile/me/photo`, `POST /professional-profile/me/logo` | ADMIN, NUTRITIONIST |
| Evolutions | `GET/POST /patients/:patientId/evolutions` | ADMIN, NUTRITIONIST |
| Evolutions | `GET/PATCH/DELETE /evolutions/:id`, `PATCH /evolutions/:id/share` | ADMIN, NUTRITIONIST |
| Evolutions | `POST /evolutions/:id/photos`, `DELETE /evolutions/:id/photos/:photoId` | ADMIN, NUTRITIONIST |

Toda rota tenant-scoped isola os dados pelo tenant do usuário autenticado (JWT) — nunca por parâmetro vindo do cliente. **RECEPTION não recebe `@Roles` em nenhuma rota de Evolução** — blackout completo do módulo clínico para esse perfil, decisão explícita da missão que introduziu o módulo (nem leitura).

## Decisões técnicas relevantes (Etapa 2)

- **CPF**: opcional, armazenado só com dígitos (normalizado no backend), validado com dígitos verificadores reais (não apenas formato). Único por `(tenantId, cpf)` — o mesmo CPF pode existir em clínicas diferentes, nunca duas vezes na mesma clínica.
- **Telefones**: aceitam máscara no frontend, mas são normalizados (só dígitos) antes de persistir. O link do WhatsApp é gerado a partir do telefone normalizado, assumindo DDI +55.
- **Exclusão lógica**: `DELETE /patients/:id` nunca apaga a linha — move o paciente para o status `ARCHIVED`. `DELETE /plans/:id` marca `deletedAt` e bloqueia se o plano já tiver sido usado em algum ciclo de tratamento.
- **Unicidade de nome de plano por tenant**: implementada como índice único **parcial** (`WHERE "deletedAt" IS NULL`) via migration SQL manual, já que o Prisma não expressa isso no schema — permite reaproveitar o nome de um plano depois de excluído.
- **Nutricionista responsável**: validado no backend para pertencer ao mesmo tenant e ter o perfil `NUTRITIONIST` — nunca aceito de outro tenant, mesmo que o UUID exista.
- **Valores monetários**: sempre `Decimal(12,2)` no Postgres/Prisma, nunca `float`, para evitar erro de arredondamento.
- **Auditoria**: `AuditService` (`backend/src/common/audit`) grava criação/edição/mudança de status/arquivamento de pacientes e planos no `AuditLog`, com ator, timestamp e diff — consumido pela aba "Histórico" do perfil do paciente.

## Decisões técnicas relevantes (Missão 0003 — identidade profissional e evolução corporal)

- **Identidade nunca é o tenant**: `ProfessionalProfile` (1:1 por tenant) guarda nome de exibição, foto, CRN, especialidade e paleta de cores — o cabeçalho, a saudação e a sidebar sempre leem daqui, nunca de `Tenant.name` ou do e-mail. Na primeira leitura, se o perfil ainda não existir, é criado automaticamente com valores derivados do tenant (retrocompatível com tenants que existiam antes desta missão).
- **Aparência embutida no perfil**: `primaryColor`/`secondaryColor`/`paletteKey` ficam no próprio `ProfessionalProfile` (não um model `Appearance` separado) — é uma relação 1:1, then separar viraria fragmentação sem ganho. O frontend aplica as cores como override de CSS custom properties (`--primary`, `--sidebar-primary`, `--ring`) em tempo de execução, então nenhuma tela precisa saber da paleta escolhida.
- **`PatientEvolution` é um snapshot, nunca é sobrescrito**: cada avaliação é uma linha própria com filhos 1:1 (`AnthropometricMeasurement`, `BioimpedanceMeasurement`) e 1:N (`SegmentalBodyMeasurement`, `EvolutionPhoto`). Editar uma avaliação atualiza só aquele registro; uma nova avaliação nunca toca nas anteriores.
- **Segmentar como linhas, não colunas fixas**: `SegmentalBodyMeasurement` é `(evolutionId, segment, metricType, valueKg)` em vez de uma coluna por segmento/métrica — permite novas métricas segmentares no futuro sem migração estrutural.
- **IMC sempre calculado no servidor**: nunca confia em IMC vindo do frontend. Classificação (OMS) só é aplicada para idade ≥ 18 anos calculada a partir de `Patient.birthDate` na data da avaliação; abaixo disso retorna explicitamente "não aplicada" (`backend/src/common/utils/bmi.util.ts`).
- **Pontos percentuais ≠ percentual**: a comparação entre avaliações (`frontend/src/lib/evolution-metrics.ts`) distingue métricas que já são um percentual (gordura corporal, % de músculo, % de água) — a diferença entre duas leituras aparece como "pontos percentuais" (ex.: 31% → 27% = "-4 pontos percentuais"), nunca como "-4%". Para métricas normais (peso, cintura...), mostra diferença absoluta **e** percentual relativa.
- **Indicadores de comparação são neutros**: setas de subir/descer/estável não usam verde/vermelho — o significado clínico de "subiu" varia por métrica (peso pode ser bom ou ruim dependendo do objetivo), então a cor nunca assume um sentido.
- **Métrica ausente nunca vira zero**: gráficos (`EvolutionMetricChart`) e comparação pulam pontos sem dado (`connectNulls={false}`) em vez de renderizar zero, que seria clinicamente enganoso.
- **Silhueta do mapa corporal é sempre escolha manual**: `Patient.bodySilhouettePreference` (`MALE`/`FEMALE`/`NEUTRAL`/`NOT_INFORMED`) nunca é setado automaticamente a partir de `gender` — o gênero só informa uma sugestão visual (qual silhueta aparece pré-selecionada) até o profissional escolher explicitamente e persistir.
- **RECEPTION tem blackout total do módulo de Evolução**: nenhuma rota de `/evolutions` ou `/patients/:id/evolutions` tem `RECEPTION` em `@Roles` — nem leitura. A aba "Evolução" some da UI para esse perfil, não só o formulário de edição.
- **Fotos nunca têm URL pública permanente**: `EvolutionPhoto`/`ProfessionalProfile.profilePhotoKey`/`logoKey` guardam só a chave do objeto no MinIO; toda leitura passa por `StorageService.getDownloadUrl()`, que assina uma URL de curta duração (5 min por padrão) sob demanda.
- **Portal do Paciente não foi implementado, mas o schema já nasceu pronto pra ele**: `PatientEvolution` já separa `clinicalNotes`/`internalNotes` (sempre internos) de `patientVisibleNotes` (o que poderia ser mostrado ao paciente), com `isSharedWithPatient`/`sharedAt`/`sharedByUserId` persistidos — a rota `PATCH /evolutions/:id/share` já existe e nunca expõe as notas internas.

### Complemento — revisão contra exame real de bioimpedância

Revisão feita comparando o módulo já implementado com um exame real de bioimpedância (usado só como referência local, nunca commitado — ver seção de privacidade abaixo). Preencheu lacunas reais sem refazer o que já funcionava:

- **Campos distintos, nunca sinônimos**: `proteinKg`, `mineralMassKg` e `boneMassKg` são três campos separados no `BioimpedanceMeasurement` — o exame de referência mostra os três com valores diferentes, então tratá-los como o mesmo dado esconderia informação.
- **Pontuação corporal com nome genérico**: `bodyCompositionScore`/`bodyCompositionScoreMaximum`/`bodyCompositionScoreLabel`/`bodyCompositionScoreSource` — nunca calculada pelo SmartNutri, só armazenada quando o equipamento fornece. Nome do model e dos campos é sempre genérico (nunca a marca do equipamento de origem).
- **Controle e metas com sinal preservado**: `referenceWeightKg`/`recommendedWeightChangeKg`/`recommendedFatChangeKg`/`recommendedMuscleChangeKg` aceitam valores negativos, positivos ou zero sem qualquer interpretação automática — a UI nunca assume que um ajuste negativo é "ruim".
- **Impedância segmentar como linhas por frequência**: `SegmentalImpedanceMeasurement` é `(bioimpedanceMeasurementId, frequencyValue, frequencyUnit, ...ohms por segmento)` em vez de colunas fixas para 20kHz/100kHz — aceita equipamentos com uma, duas ou várias frequências. Seção avançada e opcional no formulário (aba própria, nunca exigida).
- **Faixas de referência genéricas por campo**: `MeasurementReferenceRange` é `(evolutionId, fieldKey, minValue, maxValue, unit, source, note)` — mesmo padrão de "linhas, não colunas fixas". O SmartNutri nunca diagnostica a partir da faixa informada, só exibe de forma neutra ("Referência informada: X a Y").
- **Gordura segmentar com indicador de estimativa**: `SegmentalBodyMeasurement.isEstimated` — equipamentos costumam estimar a gordura por segmento (nunca medem diretamente); o relatório e a tela de detalhe mostram "(estimado)" quando marcado, sem esconder nem inventar precisão.
- **`bodyScore` removido**: campo antigo, mais simples, ficava redundante com o novo conjunto de pontuação — removido antes do primeiro commit da missão (nunca chegou a ser usado em produção).

## Testes

```bash
cd backend
npm test        # unitários + integração (Prisma real contra o Postgres de dev)
npm run test:e2e  # RBAC e isolamento de tenant via HTTP real (supertest)
```

Cobrem: validação de CPF/telefone, normalização, duplicidade de CPF/nome por tenant, isolamento entre tenants, paginação/busca/filtros, associação de nutricionista (mesmo tenant vs. tenant errado), mudança de status, exclusão lógica, autorização por perfil (200/403/401/404), persistência `Decimal`, criação automática do perfil profissional a partir do tenant, cálculo de IMC no servidor (incluindo ausência de peso/altura), avaliações independentes que nunca se sobrescrevem, resolução do nutricionista responsável e compartilhamento que nunca vaza nota clínica interna.

> Rodando tudo junto na mesma máquina (Docker + servidores locais + testes), alguns `beforeAll`/testes individuais podem estourar o timeout padrão de 5s do Jest por contenção de recursos, não por bug — os arquivos de `evolutions`/`professional-profile` já usam `jest.setTimeout(15000)` por causa disso. Se acontecer em outros arquivos, rode a suíte isolada (`npx jest <arquivo>`) antes de investigar como bug.

## Status

**Etapa 1 (Fundação), Etapa 2 (Pacientes e Planos) e Missão 0003 (Identidade profissional + Evolução corporal) concluídas.**

- Etapa 1: autenticação completa (login, refresh com rotação, logout, `/me`), RBAC no backend, isolamento por clínica (tenant), modelo de dados completo no Prisma, shell protegido no frontend, seed de demonstração.
- Etapa 2: CRUD completo de Pacientes (listagem com busca/filtros/paginação, cadastro, edição, perfil com abas, arquivamento) e Planos (listagem, cadastro/edição em modal, ativação/inativação), com RBAC granular por ação, validação de CPF/telefone, auditoria e testes automatizados.
- Missão 0003: produto renomeado para SmartNutri (sem nome de clínica fixo em lugar nenhum da UI); identidade profissional completa (nome, foto, CRN, contato, paleta de cores aplicada em tempo real) com página própria (`/perfil`); módulo de evolução corporal completo (antropometria, bioimpedância, análise segmentar, fotos com storage seguro via MinIO, comparação entre avaliações com pontos percentuais, gráficos reutilizáveis, mapa corporal SVG original em 3 variantes, relatório de impressão); RECEPTION com blackout total do módulo clínico; base pronta para o futuro Portal do Paciente sem implementá-lo ainda.

Próximas etapas (ciclos, agenda, financeiro, dashboard/relatórios, qualidade) seguem o plano de entrega incremental do projeto.
