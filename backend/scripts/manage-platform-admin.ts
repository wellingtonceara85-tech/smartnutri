/**
 * Provisiona, revoga ou gira a credencial do privilégio global de
 * PLATFORM_ADMIN (Missão 0005.5).
 *
 * Uso (a partir de `backend/`, com as variáveis de ambiente do banco-alvo
 * já carregadas no shell — DATABASE_URL apontando para local/staging/prod):
 *
 *   npx tsx scripts/manage-platform-admin.ts grant --email pessoa@exemplo.com
 *   npx tsx scripts/manage-platform-admin.ts revoke --email pessoa@exemplo.com
 *   npx tsx scripts/manage-platform-admin.ts reset-password --email pessoa@exemplo.com [--password "senha escolhida"]
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
 * `reset-password`:
 *   - Exige que o e-mail já exista E já seja PLATFORM_ADMIN (não é uma
 *     ferramenta genérica de reset de senha de qualquer usuário — troca de
 *     senha de usuário de tenant é fora de escopo desta missão, fica para
 *     uma futura "Conta e Segurança").
 *   - Nunca altera tenantId, nunca cria UserClinic, nunca toca
 *     isPlatformAdmin — só substitui passwordHash.
 *   - Sem `--password`, gera uma senha forte aleatória e imprime no
 *     terminal UMA ÚNICA VEZ (mesmo padrão do `grant`). Com `--password`,
 *     usa a senha fornecida e não a reimprime (quem forneceu já a conhece).
 *     Em ambos os casos só o hash bcrypt é persistido — a senha em texto
 *     puro nunca é logada em arquivo.
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

const COMMANDS = ['grant', 'revoke', 'reset-password'] as const;
type Command = (typeof COMMANDS)[number];

function readFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseArgs(): { command: Command; email: string; password?: string } {
  const [command, ...rest] = process.argv.slice(2);
  const email = readFlag(rest, '--email');
  const password = readFlag(rest, '--password');

  if (!COMMANDS.includes(command as Command)) {
    throw new Error(
      'Uso: npx tsx scripts/manage-platform-admin.ts <grant|revoke|reset-password> --email pessoa@exemplo.com [--password "senha escolhida"]',
    );
  }
  if (!email || !email.includes('@')) {
    throw new Error('Informe um e-mail válido com --email pessoa@exemplo.com');
  }
  return { command: command as Command, email: email.toLowerCase(), password };
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

async function resetPassword(email: string, providedPassword?: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    throw new Error(`Nenhum usuário encontrado com o e-mail "${email}".`);
  }
  if (!existing.isPlatformAdmin) {
    throw new Error(
      `"${email}" não é PLATFORM_ADMIN — este comando não altera senha de usuário de tenant.`,
    );
  }

  const newPassword = providedPassword ?? generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Só passwordHash muda — tenantId (inexistente para platform admin),
  // UserClinic e isPlatformAdmin permanecem exatamente como estavam.
  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash },
  });

  console.log(`Senha de "${email}" redefinida. A senha anterior parou de funcionar.`);
  if (!providedPassword) {
    console.log('');
    console.log('Nova senha (exibida uma única vez — copie agora):');
    console.log(`  ${newPassword}`);
    console.log('');
    console.log(
      'Guarde-a em um gerenciador de senhas. Ela não fica registrada em nenhum log ou arquivo.',
    );
  }
}

async function main() {
  const { command, email, password } = parseArgs();
  if (command === 'grant') {
    await grant(email);
  } else if (command === 'revoke') {
    await revoke(email);
  } else {
    await resetPassword(email, password);
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
