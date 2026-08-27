import { z } from 'zod';

export function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body || {},
        query: req.query || {},
        params: req.params || {},
      });
      // Overwrite with parsed (sanitized) values where applicable
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query;
      if (parsed.params) req.params = parsed.params;
      next();
    } catch (e) {
      const msg = e.errors?.[0]?.message || e.issues?.[0]?.message || 'Validation error';
      return res.status(400).json({ error: msg });
    }
  };
}

// Common schemas
export const emailSchema = z.string().email('Имэйл буруу байна').max(120);
export const passwordSchema = z.string().min(8, 'Нууц үг хамгийн багадаа 8 тэмдэгт').max(72);
