import { Router } from 'express';
import { ClientAuthenticatedRequest } from '../middleware/clientAuth';

const router = Router();

/**
 * GET /api/client/me
 * Returns the authenticated client's info.
 */
router.get('/me', (req, res) => {
  const clientReq = req as ClientAuthenticatedRequest;
  const client = clientReq.client;

  if (!client) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  res.json({
    companyName: client.companyName,
    sdkApiKey: client.sdkApiKey,
    id: client.id,
  });
});

export default router;
