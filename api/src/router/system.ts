import { Router } from 'express';
import os from 'os';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Minimal Prometheus-style metrics placeholder
router.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  const lines = [
    '# HELP api_up API up status',
    '# TYPE api_up gauge',
    `api_up{service="api",host="${os.hostname()}"} 1`,
  ];
  res.send(lines.join('\n'));
});

export default router;
