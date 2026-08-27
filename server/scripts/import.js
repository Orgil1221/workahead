// Standalone importer: node scripts/import.js <files...> --program=<programId>
// Example: npm run import -- ../../files/math1b-2024-import.json
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import { importExamJson } from '../src/services/importService.js';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const programArg = args.find((a) => a.startsWith('--program='));
  const files = args.filter((a) => !a.startsWith('--'));
  const programId = programArg?.split('=')[1];

  if (!files.length || !programId) {
    console.log('Хэрэглээ: node scripts/import.js <файл.json ...> --program=<programId>');
    process.exit(1);
  }

  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(f, 'utf8'));
      const r = await importExamJson(data, programId);
      console.log(`✓ ${f} → ${r.code}: ${r.imported} асуулт`);
    } catch (e) {
      console.error(`✗ ${f}: ${e.message}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
