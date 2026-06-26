import 'dotenv/config';
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { BUILDER_CODE, declareBuilderCodeExtension } from '@x402/extensions/builder-code';

const app = express();
app.use(express.json());

// Log every incoming request
app.use((req, res, next) => {
  console.log(`[v0] ${req.method} \( {req.path} ua=" \){req.get('user-agent') || ''}"`);
  next();
});

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.header(
    'Access-Control-Expose-Headers',
    'PAYMENT-REQUIRED, PAYMENT-RESPONSE, PAYMENT-SIGNATURE, X-PAYMENT-RESPONSE, payment-required, payment-response, x-payment-response'
  );
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ====================== Config ======================
const PAY_TO = process.env.PAY_TO?.trim();
const PRICE = '$0.01';
const NETWORK = 'eip155:8453'; // Base Mainnet

const FACILITATOR_URL = process.env.FACILITATOR_URL?.trim() || 'https://facilitator.payai.network';

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID?.trim();
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET?.trim();

const BUILDER_CODE_VALUE = process.env.BUILDER_CODE?.trim();

const DRIVE_FILE_ID = '1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp';
const DOWNLOAD_LINK = `https://drive.google.com/uc?export=download&id=${DRIVE_FILE_ID}`;

const PORT = Number(process.env.PORT) || 8080;

const missing = [];
if (!PAY_TO) missing.push('PAY_TO');
if (!BUILDER_CODE_VALUE) {
  console.warn('⚠️ BUILDER_CODE env var is missing — payments will not be attributed on Base');
}

// ====================== Health / State ======================
let x402Ready = false;
let initError = null;   // ← Must stay at top level

// ====================== Health check ======================
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BrokenKeyRemapper x402',
    network: NETWORK,
    price: PRICE,
    payTo: PAY_TO,
    facilitator: FACILITATOR_URL,
    builderCode: BUILDER_CODE_VALUE || 'NONE',
    endpoint: '/download',
    envOk: missing.length === 0,
    missingEnv: missing,
    x402Ready,
    initError: initError ? String(initError) : null,
  });
});

// ====================== x402 Setup ======================
async function setupX402() {
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(', ')}`);
  }

  const isCDP = FACILITATOR_URL.includes('api.cdp.coinbase.com');

  const facilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
    ...(isCDP && CDP_API_KEY_ID && CDP_API_KEY_SECRET
      ? { headers: { Authorization: `Bearer \( {CDP_API_KEY_ID}: \){CDP_API_KEY_SECRET}` } }
      : {}),
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    NETWORK,
    new ExactEvmScheme()
  );

  console.log('[v0] Initializing resourceServer...');
  await resourceServer.initialize();
  console.log('[v0] resourceServer initialized');

  const routes = {
    'GET /download': {
      accepts: [
        {
          scheme: 'exact',
          price: PRICE,
          network: NETWORK,
          payTo: PAY_TO,
          maxTimeoutSeconds: 60,
        },
      ],
      description: 'Broken Key Remapper Full Software Download',
      mimeType: 'application/json',
      extensions: {
        [BUILDER_CODE]: declareBuilderCodeExtension(BUILDER_CODE_VALUE),
      },
    },
  };

  app.use(paymentMiddleware(routes, resourceServer));

  app.get('/download', (req, res) => {
    const payer = req.x402Payment?.payer || req.x402?.payment?.payer || 'unknown';
    console.log('[v0] Payment verified, serving download to:', payer);

    res.json({
      success: true,
      message: 'Thank you for your purchase!',
      downloadLink: DOWNLOAD_LINK,
      expiresIn: '24 hours',
      version: '1.2',
      instructions: 'Download, extract, and run BrokenKeyRemapper.exe',
    });
  });

  console.log('[v0] x402 middleware registered with Builder Code:', BUILDER_CODE_VALUE);
}

// ====================== Boot ======================
async function main() {
  try {
    await setupX402();
    x402Ready = true;
    console.log('[v0] ✅ x402 fully initialized');
  } catch (err) {
    initError = err;
    console.error('[v0] ❌ Failed to initialize x402:', err);

    // Fallback route if init failed
    app.get('/download', (req, res) => {
      res.status(500).json({
        error: 'x402 initialization failed',
        reason: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // 404 handler — must be last
  app.use((req, res) => {
    res.status(404).json({
      error: 'Route not found',
      path: req.path,
      availableRoutes: ['GET /', 'GET /download'],
      x402Ready,
      initError: initError ? String(initError) : null,
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[v0] Server listening on 0.0.0.0:${PORT}`);
    console.log(`[v0] x402 ready: ${x402Ready}`);
  });
}

main().catch((err) => {
  console.error('[v0] Fatal boot error:', err);
  process.exit(1);
});

// Keep alive
process.on('unhandledRejection', (reason) => {
  console.error('[v0] Unhandled rejection (ignored):', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[v0] Uncaught exception (ignored):', err?.message || err);
});
