import { Router } from 'express';
import { DEMO_SESSION_TOKEN, getDemoMonthlySummary } from '@/shared/demo/demoData.js';

const router = Router();

function checkAuth(authHeader: string | undefined): boolean {
  if (!authHeader) return false;
  return authHeader.replace('Bearer ', '') === DEMO_SESSION_TOKEN;
}

router.get('/', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const now = new Date();
  const query = req.query as Record<string, string | undefined>;
  const month = parseInt(query['month'] ?? '') || (now.getMonth() + 1);
  const year = parseInt(query['year'] ?? '') || now.getFullYear();

  res.json(getDemoMonthlySummary(month, year));
});

const _router: Router = router;
export { _router as summaryRouter };
