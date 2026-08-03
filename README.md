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

## Status

**Etapa 1 (Fundação) concluída**: autenticação completa (login, refresh com rotação, logout, `/me`), RBAC no backend, isolamento por clínica (tenant), modelo de dados completo no Prisma (mesmo que só uma parte tenha endpoint ligado ainda), shell protegido no frontend com navegação por perfil, seed de demonstração.

Próximas etapas (pacientes/planos, ciclos, agenda, financeiro, evolução, dashboard/relatórios, qualidade) seguem o plano de entrega incremental do projeto.
