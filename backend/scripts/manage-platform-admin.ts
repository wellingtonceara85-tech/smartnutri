/**
 * Provisiona ou revoga o privilégio global de PLATFORM_ADMIN (Missão 0005.5).
 *
 * Uso (a partir de `backend/`, com as variáveis de ambiente do banco-alvo
 * já carregadas no shell — DATABASE_URL apontando para local/staging/prod):
 *
 *   npx tsx scripts/manage-platform-admin.ts grant --email pessoa@exemplo.com
 *   npx tsx scripts/manage-platform-admin.ts revoke --email pessoa@exemplo.com
 *
 * `grant`:
 *   - Se o e-mail já existe como User, apenas promove (isPlatformAdmin = true),
 *     sem tocar na senha existente.
 *   - Se não existe, cria um User novo com isPlatformAdmin = true, SEM
 *     nenhuma linha em UserClinic (nunca ganha tenantId nem role de tenant),
 *     com uma senha temporária aleatória impressa UMA ÚNICA VEZ no terminal.
 *     Essa senha nunca é logada em arquivo nem persistida em texto puro —
 *     só existe hasheada (bcrypt) no banco a partir deste ponto.
 *
 * `revoke`:
 *   - Define isPlatformAdmin = false. Nunca apaga o usuário nem qualquer
 *     outro dado (mesma filosofia de "suspender não é apagar" já usada
 *     para Tenant nesta missão).
 *
 * Este script é de uso manual e administrativo — não faz parte de nenhum
 * fluxo automático de build, seed ou deploy.
 */
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const BCRYPT_ROUNDS = 12;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function parseArgs(): { command: string; email: string } {
  const [command, ...rest] = process.argv.slice(2);
  const emailFlagIndex = rest.indexOf('--email');
  const email = emailFlagIndex >= 0 ? rest[emailFlagIndex + 1] : undefined;

  if (command !== 'grant' && command !== 'revoke') {
    throw new Error(
      'Uso: npx tsx scripts/manage-platform-admin.ts <grant|revoke> --email pessoa@exemplo.com',
    );
  }
  if (!email || !email.includes('@')) {
    throw new Error('Informe um e-mail válido com --email pessoa@exemplo.com');
  }
  return { command, email: email.toLowerCase() };
}

function generateTemporaryPassword(): string {
  return crypto.randomBytes(18).toString('base64url');
}

async function grant(email: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.isPlatformAdmin) {
      console.log(`"${email}" já é PLATFORM_ADMIN — nada a fazer.`);
      return;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { isPlatformAdmin: true },
    });
    console.log(
      `"${email}" promovido a PLATFORM_ADMIN. Senha existente não foi alterada.`,
    );
    return;
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      name: email.split('@')[0],
      passwordHash,
      isPlatformAdmin: true,
    },
  });

  console.log(`PLATFORM_ADMIN criado: ${user.email} (id ${user.id})`);
  console.log('');
  console.log('Senha temporária (exibida uma única vez — copie agora):');
  console.log(`  ${temporaryPassword}`);
  console.log('');
  console.log(
    'Guarde-a em um gerenciador de senhas e não a compartilhe por canais inseguros.',
  );
}

async function revoke(email: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    throw new Error(`Nenhum usuário encontrado com o e-mail "${email}".`);
  }
  if (!existing.isPlatformAdmin) {
    console.log(`"${email}" já não é PLATFORM_ADMIN — nada a fazer.`);
    return;
  }
  await prisma.user.update({
    where: { id: existing.id },
    data: { isPlatformAdmin: false },
  });
  console.log(
    `Privilégio de PLATFORM_ADMIN revogado de "${email}". A conta continua existindo normalmente.`,
  );
}

async function main() {
  const { command, email } = parseArgs();
  if (command === 'grant') {
    await grant(email);
  } else {
    await revoke(email);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
