/**
 * Script de uso único: setea whatsapp/phone de los usuarios del equipo
 * Ejecutar en EasyPanel console: npx tsx prisma/set-user-phones.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PHONES: { email: string; name: string; whatsapp: string }[] = [
  { email: 'user18@example.com',                   name: 'John Mónoga',    whatsapp: '3000000030' },
  { email: 'user21@example.com',                   name: 'Lady',           whatsapp: '3000000024' },
  { email: 'user15@example.com',      name: 'Janneth Mónoga', whatsapp: '3000000023' },
  { email: 'user12@example.com',   name: 'John (ingenieria)', whatsapp: '3000000030' },
];

async function main() {
  for (const p of PHONES) {
    const user = await prisma.user.findUnique({ where: { email: p.email } });
    if (!user) {
      console.log(`⚠  No encontrado: ${p.email}`);
      continue;
    }
    await prisma.user.update({
      where: { email: p.email },
      data: { whatsapp: p.whatsapp, phone: p.whatsapp },
    });
    console.log(`✓  ${user.name} (${p.email}) → WhatsApp: ${p.whatsapp}`);
  }
  console.log('\nListo. Ahora las notificaciones funcionarán.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
