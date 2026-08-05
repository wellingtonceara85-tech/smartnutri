# Sistema de Gestão para Clínica de Nutrição

Sistema web multiempresa para substituir a planilha de controle de pacientes, planos, ciclos de consultas e pagamentos de uma clínica de nutrição. Consultas, cobranças e pagamentos são entidades independentes e relacionadas — não colunas fixas de planilha — com histórico completo e autorização por perfil aplicada no backend.

O plano completo (modelagem, rotas, decisões de arquitetura, etapas de entrega) está registrado no histórico do projeto. Este README cobre apenas como rodar o que já existe.

## Stack

- **Frontend**: Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui + React Hook Form + Zod
- **Backend**: NestJS + TypeScript + Prisma ORM + PostgreSQL + Swagger
- **Auth**: JWT (access token curto + refresh token httpOnly rotacionado, com detecção de reuso) + RBAC por perfil (`ADMIN`, `NUTRITIONIST`, `RECEPTION`)
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
| minio | http://localhost:9020 (API) / http://localhost:9021 (console) | Storage S3-compatible p/ documentos (etapas futuras) |

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

Toda rota tenant-scoped isola os dados pelo tenant do usuário autenticado (JWT) — nunca por parâmetro vindo do cliente.

## Decisões técnicas relevantes (Etapa 2)

- **CPF**: opcional, armazenado só com dígitos (normalizado no backend), validado com dígitos verificadores reais (não apenas formato). Único por `(tenantId, cpf)` — o mesmo CPF pode existir em clínicas diferentes, nunca duas vezes na mesma clínica.
- **Telefones**: aceitam máscara no frontend, mas são normalizados (só dígitos) antes de persistir. O link do WhatsApp é gerado a partir do telefone normalizado, assumindo DDI +55.
- **Exclusão lógica**: `DELETE /patients/:id` nunca apaga a linha — move o paciente para o status `ARCHIVED`. `DELETE /plans/:id` marca `deletedAt` e bloqueia se o plano já tiver sido usado em algum ciclo de tratamento.
- **Unicidade de nome de plano por tenant**: implementada como índice único **parcial** (`WHERE "deletedAt" IS NULL`) via migration SQL manual, já que o Prisma não expressa isso no schema — permite reaproveitar o nome de um plano depois de excluído.
- **Nutricionista responsável**: validado no backend para pertencer ao mesmo tenant e ter o perfil `NUTRITIONIST` — nunca aceito de outro tenant, mesmo que o UUID exista.
- **Valores monetários**: sempre `Decimal(12,2)` no Postgres/Prisma, nunca `float`, para evitar erro de arredondamento.
- **Auditoria**: `AuditService` (`backend/src/common/audit`) grava criação/edição/mudança de status/arquivamento de pacientes e planos no `AuditLog`, com ator, timestamp e diff — consumido pela aba "Histórico" do perfil do paciente.

## Testes

```bash
cd backend
npm test        # unitários + integração (Prisma real contra o Postgres de dev)
npm run test:e2e  # RBAC e isolamento de tenant via HTTP real (supertest)
```

Cobrem: validação de CPF/telefone, normalização, duplicidade de CPF/nome por tenant, isolamento entre tenants, paginação/busca/filtros, associação de nutricionista (mesmo tenant vs. tenant errado), mudança de status, exclusão lógica, autorização por perfil (200/403/401/404) e persistência `Decimal`.

## Status

**Etapa 1 (Fundação) e Etapa 2 (Pacientes e Planos) concluídas.**

- Etapa 1: autenticação completa (login, refresh com rotação, logout, `/me`), RBAC no backend, isolamento por clínica (tenant), modelo de dados completo no Prisma, shell protegido no frontend, seed de demonstração.
- Etapa 2: CRUD completo de Pacientes (listagem com busca/filtros/paginação, cadastro, edição, perfil com abas, arquivamento) e Planos (listagem, cadastro/edição em modal, ativação/inativação), com RBAC granular por ação, validação de CPF/telefone, auditoria e testes automatizados.

Próximas etapas (ciclos, agenda, financeiro, evolução, dashboard/relatórios, qualidade) seguem o plano de entrega incremental do projeto.
