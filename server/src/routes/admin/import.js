import { Router } from 'express';
import multer from 'multer';
import prisma from '../../db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { importExamJson, importExamCsv } from '../../services/importService.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 1, parts: 6, fieldNameSize: 100, fieldSize: 128 },
});
router.use(requireAuth, requireAdmin);

// Upload one or more import-format JSON files targeting a program
router.post('/upload', upload.array('files', 20), async (req, res, next) => {
  try {
    const programId = req.body.programId;
    if (!programId) return res.status(400).json({ error: 'Хөтөлбөр сонгоно уу' });
    if (!req.files?.length) return res.status(400).json({ error: 'Файл сонгоогүй байна' });

    const results = [];
    const errors = [];
    for (const file of req.files) {
      try {
        const data = JSON.parse(file.buffer.toString('utf8'));
        const result = await importExamJson(data, programId);
        results.push({ file: file.originalname, ...result });
      } catch (e) {
        errors.push({ file: file.originalname, error: e.message });
      }
    }
    res.json({ results, errors });
  } catch (e) { next(e); }
});

// Paste raw JSON
router.post('/raw', async (req, res, next) => {
  try {
    const { programId, json } = req.body;
    if (!programId) return res.status(400).json({ error: 'Хөтөлбөр сонгоно уу' });
    let data;
    try { data = typeof json === 'string' ? JSON.parse(json) : json; }
    catch { return res.status(400).json({ error: 'JSON parse алдаа' }); }
    const result = await importExamJson(data, programId);
    res.json({ results: [{ file: '(paste)', ...result }], errors: [] });
  } catch (e) { next(e); }
});

// CSV import
router.post('/csv', async (req, res, next) => {
  try {
    const result = await importExamCsv(req.body || {});
    res.json({ results: [{ file: '(csv)', ...result }], errors: [] });
  } catch (e) { next(e); }
});

// Download a template of the expected structure
router.get('/template', async (_req, res) => {
  res.json({
    exam_id: 'math1b-2024-fall-variant1',
    title: 'Математик 1Б — Явцын шалгалт (2024)',
    source: '2024 оны бодит явцын шалгалт',
    year: 2024,
    variant: 'Variant 1',
    questions: [
      {
        type: 'open',
        prompt: 'Асуултын бүрэн текст…',
        model_solution: 'Иж бүрэн шийдэл…',
        answer: 'Эцсийн хариулт',
        points: 3,
        needs_review: true,
        tags: ['сэдэв', 'дэд сэдэв'],
      },
    ],
  });
});

export default router;
