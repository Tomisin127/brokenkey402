import 'dotenv/config';
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';

const app = express();
app.use(express.json());

// Log every incoming request
app.use((req, res, next) => {
  console.log(`[v0] ${req.method} ${req.path} ua="${req.get('user-agent') || ''}"`);
  next();
});

// CORS - expose x402 headers so clients can read them
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
const NETWORK = 'eip155:8453'; // Base Mainnet (CAIP-2)

// Facilitator selection:
//   - CDP (recommended for mainnet, requires CDP API keys):
//       https://api.cdp.coinbase.com/platform/v2/x402
//   - PayAI (no auth, third-party, mainnet capable):
//       https://facilitator.payai.network
//   - x402.org (TESTNET ONLY - will NOT work for eip155:8453):
//       https://x402.org/facilitator
const FACILITATOR_URL =
  process.env.FACILITATOR_URL?.trim() || 'https://facilitator.payai.network';

// Optional CDP auth (only used when FACILITATOR_URL points to CDP)
const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID?.trim();
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET?.trim();

const DRIVE_FILE_ID = '1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp';
const DOWNLOAD_LINK = `https://drive.google.com/uc?export=download&id=${DRIVE_FILE_ID}`;

const PORT = Number(process.env.PORT) || 8080;

const missing = [];
if (!PAY_TO) missing.push('PAY_TO');

console.log('BrokenKeyRemapper x402 Mainnet');
console.log('Price:', PRICE);
console.log('Network:', NETWORK);
console.log('PayTo:', PAY_TO || 'MISSING');
console.log('Facilitator:', FACILITATOR_URL);

// ====================== Health check ======================
let x402Ready = false;
let initError = null;

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BrokenKeyRemapper x402',
    network: NETWORK,
    price: PRICE,
    payTo: PAY_TO,
    facilitator: FACILITATOR_URL,
    endpoint: '/download',
    envOk: missing.length === 0,
    missingEnv: missing,
    x402Ready,
    initError: initError ? String(initError) : null,
  });
});

// ====================== x402 Setup (async) ======================
async function setupX402() {
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(', ')}`);
  }

  // Build facilitator client. CDP needs auth headers; PayAI / x402.org don't.
  const isCDP = FACILITATOR_URL.includes('api.cdp.coinbase.com');

  const facilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
    ...(isCDP && CDP_API_KEY_ID && CDP_API_KEY_SECRET
      ? {
          headers: {
            Authorization: `Bearer ${CDP_API_KEY_ID}:${CDP_API_KEY_SECRET}`,
          },
        }
      : {}),
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    NETWORK,
    new ExactEvmScheme()
  );

  // **CRITICAL FIX**: ask the facilitator which (scheme, network) pairs it
  // supports. Without this, buildPaymentRequirements throws:
  //   "Facilitator does not support exact on eip155:8453"
  console.log('[v0] Calling resourceServer.initialize()...');
  await resourceServer.initialize();
  console.log('[v0] resourceServer.initialize() OK');

  // accepts is an array per the v2 spec / @x402/core README
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
    },
  };

  // NOTE: do NOT pass `false` as the 5th arg - that disables auto-init and
  // was the root cause of the original 500. We've already initialized manually.
  app.use(paymentMiddleware(routes, resourceServer));

  // Protected handler - only runs AFTER middleware verifies payment
  app.get('/download', (req, res) => {
    const payer =
      req.x402Payment?.payer || req.x402?.payment?.payer || 'unknown';
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

  console.log('[v0] x402 middleware registered for GET /download');
}

// ====================== Boot ======================
async function main() {
  try {
    await setupX402();
    x402Ready = true;
  } catch (err) {
    initError = err;
    console.error('[v0] Failed to initialize x402:', err);

    app.get('/download', (req, res) => {
      res.status(500).json({
        error: 'x402 not initialized',
        reason: err instanceof Error ? err.message : String(err),
        missingEnv: missing,
      });
    });
  }

  // 404 (must be last)
  app.use((req, res) => {
    console.log('[v0] 404 for', req.method, req.path);
    res.status(404).json({
      error: 'Route not found',
      path: req.path,
      method: req.method,
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

main();

// Keep the process alive on transient errors
process.on('unhandledRejection', (err) => {
  console.error('[v0] Unhandled rejection (ignored to stay alive):', err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('[v0] Uncaught exception (ignored to stay alive):', err?.message || err);
});
