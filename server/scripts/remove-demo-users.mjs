// Demo/demo хэрэглэгчдийг устгах скрипт — ПРОДАКШНД БАЙРШУУЛАХЫН ӨМНӨ ажиллуулна.
// Ашиглалт: node scripts/remove-demo-users.mjs
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO = ['admin@workahead.mn', 'student@workahead.mn', 'admin2@workahead.mn'];

const result = await prisma.user.deleteMany({ where: { email: { in: DEMO } } });
console.log(`Устгагдсан: ${result.count} хэрэглэгч (${DEMO.join(', ')})`);
await prisma.$disconnect();
