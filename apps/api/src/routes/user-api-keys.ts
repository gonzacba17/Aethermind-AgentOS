import { Router, Request, Response } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import logger from '../utils/logger';

const router = Router();

// SECURITY: Encryption key MUST be set in production - no fallback allowed
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY: API_KEY_ENCRYPTION_KEY must be set and be at least 32 characters in production');
  }
  logger.warn('⚠️ API_KEY_ENCRYPTION_KEY not set - user API keys will not be securely stored');
}

// Use a secure key derivation even if key is weak (development only)
const getEncryptionKey = (): string => {
  if (!ENCRYPTION_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Encryption key not configured');
    }
    return 'dev-only-insecure-key-32-chars!!';
  }
  return ENCRYPTION_KEY;
};

// Encrypt API key with AES-256-CBC
function encrypt(text: string): string {
  const encKey = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  // Use proper salt with scrypt for key derivation
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(encKey, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Store salt:iv:encrypted for proper decryption
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
}

// Decrypt API key
function decrypt(encryptedText: string): string {
  const encKey = getEncryptionKey();
  const parts = encryptedText.split(':');

  // Handle legacy format (iv:encrypted) vs new format (salt:iv:encrypted)
  let salt: Buffer;
  let iv: Buffer;
  let encrypted: string;

  if (parts.length === 2) {
    // Legacy format - use static salt
    salt = Buffer.from('salt');
    iv = Buffer.from(parts[0]!, 'hex');
    encrypted = parts[1]!;
  } else if (parts.length === 3) {
    // New format with proper salt
    salt = Buffer.from(parts[0]!, 'hex');
    iv = Buffer.from(parts[1]!, 'hex');
    encrypted = parts[2]!;
  } else {
    throw new Error('Invalid encrypted key format');
  }

  const key = crypto.scryptSync(encKey, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Mask API key for display
function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}

// Validation schema
const apiKeySchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'cohere', 'google', 'azure', 'custom']),
  name: z.string().min(1).max(100),
  apiKey: z.string().min(10),
});

// Validate API key with provider
async function validateApiKey(provider: string, apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    switch (provider) {
      case 'openai':
        const openaiRes = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (openaiRes.status === 401) return { valid: false, error: 'Invalid API key' };
        if (!openaiRes.ok) return { valid: false, error: `API error: ${openaiRes.status}` };
        return { valid: true };

      case 'anthropic':
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
        });
        // 400 means key is valid but request is malformed (which is fine for validation)
        if (anthropicRes.status === 401) return { valid: false, error: 'Invalid API key' };
        return { valid: true };

      case 'cohere':
        const cohereRes = await fetch('https://api.cohere.ai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (cohereRes.status === 401) return { valid: false, error: 'Invalid API key' };
        return { valid: true };

      default:
        // For custom providers, just accept the key
        return { valid: true };
    }
  } catch (error: any) {
    return { valid: false, error: error.message || 'Validation failed' };
  }
}

// GET /api/user/api-keys - List user's API keys
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const keys = await db
      .select({
        id: schema.userApiKeys.id,
        provider: schema.userApiKeys.provider,
        name: schema.userApiKeys.name,
        maskedKey: schema.userApiKeys.maskedKey,
        isValid: schema.userApiKeys.isValid,
        lastValidated: schema.userApiKeys.lastValidated,
        createdAt: schema.userApiKeys.createdAt,
      })
      .from(schema.userApiKeys)
      .where(eq(schema.userApiKeys.userId, userId));

    res.json({ keys });
  } catch (error: any) {
    console.error('[API Keys] Error fetching keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// POST /api/user/api-keys - Add a new API key
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate input
    const parsed = apiKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const { provider, name, apiKey } = parsed.data;

    // Validate with provider
    const validation = await validateApiKey(provider, apiKey);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error || 'Invalid API key' });
    }

    // Encrypt and save
    const encryptedKey = encrypt(apiKey);
    const maskedKey = maskApiKey(apiKey);

    const [inserted] = await db
      .insert(schema.userApiKeys)
      .values({
        userId,
        provider,
        name,
        encryptedKey,
        maskedKey,
        isValid: true,
        lastValidated: new Date(),
      })
      .returning({
        id: schema.userApiKeys.id,
        provider: schema.userApiKeys.provider,
        name: schema.userApiKeys.name,
        maskedKey: schema.userApiKeys.maskedKey,
        isValid: schema.userApiKeys.isValid,
        createdAt: schema.userApiKeys.createdAt,
      });

    res.status(201).json({ key: inserted });
  } catch (error: any) {
    console.error('[API Keys] Error adding key:', error);
    res.status(500).json({ error: 'Failed to add API key' });
  }
});

// DELETE /api/user/api-keys/:id - Delete an API key
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const keyId = req.params.id;
    if (!keyId) {
      return res.status(400).json({ error: 'Missing key ID' });
    }

    const result = await db
      .delete(schema.userApiKeys)
      .where(and(
        eq(schema.userApiKeys.id, keyId as string),
        eq(schema.userApiKeys.userId, userId as string)
      ))
      .returning({ id: schema.userApiKeys.id });

    if (result.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ message: 'API key deleted' });
  } catch (error: any) {
    console.error('[API Keys] Error deleting key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// POST /api/user/api-keys/:id/validate - Re-validate an API key
router.post('/:id/validate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const keyId = req.params.id;
    if (!keyId) {
      return res.status(400).json({ error: 'Missing key ID' });
    }

    // Get the key
    const [key] = await db
      .select()
      .from(schema.userApiKeys)
      .where(and(
        eq(schema.userApiKeys.id, keyId as string),
        eq(schema.userApiKeys.userId, userId as string)
      ));

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Decrypt and validate
    const decryptedKey = decrypt(key.encryptedKey);
    const validation = await validateApiKey(key.provider, decryptedKey);

    // Update validation status
    await db
      .update(schema.userApiKeys)
      .set({
        isValid: validation.valid,
        lastValidated: new Date(),
      })
      .where(eq(schema.userApiKeys.id, keyId as string));

    res.json({ valid: validation.valid, error: validation.error });
  } catch (error: any) {
    console.error('[API Keys] Error validating key:', error);
    res.status(500).json({ error: 'Failed to validate API key' });
  }
});

// GET /api/user/api-keys/:provider/usage - Get usage/costs from provider
router.get('/:provider/usage', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const provider = req.params.provider;
    if (!provider) {
      return res.status(400).json({ error: 'Missing provider' });
    }

    // Get the user's API key for this provider
    const [key] = await db
      .select()
      .from(schema.userApiKeys)
      .where(and(
        eq(schema.userApiKeys.userId, userId as string),
        eq(schema.userApiKeys.provider, provider as string),
        eq(schema.userApiKeys.isValid, true)
      ))
      .limit(1);

    if (!key) {
      return res.status(404).json({ error: `No valid ${provider} API key configured` });
    }

    const decryptedKey = decrypt(key.encryptedKey);

    // Fetch usage based on provider
    switch (provider) {
      case 'openai':
        // OpenAI doesn't have a direct usage API via API key
        // Usage is available in the dashboard at https://platform.openai.com/usage
        // We would need to track usage ourselves by logging all API calls
        return res.json({
          provider: 'openai',
          message: 'OpenAI usage is tracked automatically when using this key through Aethermind',
          usage: null,
        });

      case 'anthropic':
        // Anthropic also tracks usage in their console
        return res.json({
          provider: 'anthropic',
          message: 'Anthropic usage is tracked automatically when using this key through Aethermind',
          usage: null,
        });

      default:
        return res.json({
          provider,
          message: 'Usage tracking is handled by Aethermind',
          usage: null,
        });
    }
  } catch (error: any) {
    console.error('[API Keys] Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

export default router;
