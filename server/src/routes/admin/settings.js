import { Router } from 'express';
import prisma from '../../db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const LANDING_THEMES = ['auto', 'clear', 'rain', 'snow', 'newyear'];

// Landing цаг агаарын theme унших
router.get('/landing-theme', async (_req, res, next) => {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: 'landingTheme' } });
    res.json({ landingTheme: row?.value || 'auto' });
  } catch (e) { next(e); }
});

// Landing цаг агаарын theme хадгалах — бүх зочдод шууд үйлчилнэ
router.put('/landing-theme', async (req, res, next) => {
  try {
    const { landingTheme } = req.body || {};
    if (!LANDING_THEMES.includes(landingTheme)) {
      return res.status(400).json({ error: 'Theme буруу байна (auto/clear/rain/snow/newyear)' });
    }
    const row = await prisma.siteSetting.upsert({
      where: { key: 'landingTheme' },
      update: { value: landingTheme },
      create: { key: 'landingTheme', value: landingTheme },
    });
    res.json({ landingTheme: row.value });
  } catch (e) { next(e); }
});

export default router;
