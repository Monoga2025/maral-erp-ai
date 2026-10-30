import { Router, Response } from 'express';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || './uploads');
router.use(authenticate);

router.get('/:filename', (req: AuthRequest, res: Response) => {
  const filename = req.params.filename;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename) || filename.includes('..') || !/\.(jpe?g|png|webp)$/i.test(filename)) {
    res.status(400).json({ error: 'Archivo inválido' });
    return;
  }
  const filePath = path.resolve(uploadRoot, filename);
  if (path.dirname(filePath) !== uploadRoot) {
    res.status(400).json({ error: 'Archivo inválido' });
    return;
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(filePath, (error) => {
    if (error && !res.headersSent) res.status(404).json({ error: 'Archivo no encontrado' });
  });
});

export default router;
