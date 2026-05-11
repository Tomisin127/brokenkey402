import 'dotenv/config';
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';

const app = express();
app.use(express.json());

// Log every incoming request so we can see what the validator hits
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
    'PAYMENT-REQUIRED, X-PAYMENT-RESPONSE, payment-required, x-payment-response'
  );
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ====================== Config ======================
const PAY_TO = process.env.PAY_TO?.trim();
const PRICE = '$0.01';
const NETWORK = 'eip155:8453'; // Base Mainnet

// Public facilitator (x402.org reference implementation - free, no auth)
// Override via FACILITATOR_URL env var if you want to use another one
// e.g. https://facilitator.payai.network
const FACILITATOR_URL =
  process.env.FACILITATOR_URL?.trim() || 'https://facilitator.payai.network';

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
  });
});

// ====================== x402 Setup ======================
let x402Ready = false;
let initError = null;

try {
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(', ')}`);
  }

  // Public facilitator - just a URL, no auth headers needed
  const facilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    NETWORK,
    new ExactEvmScheme()
  );

  // accepts is a SINGLE OBJECT per the official @x402/express v2 README
  const routes = {
    'GET /download': {
      accepts: {
        scheme: 'exact',
        price: PRICE,
        network: NETWORK,
        payTo: PAY_TO,
        maxTimeoutSeconds: 60,
      },
      description: 'Broken Key Remapper Full Software Download',
      mimeType: 'application/json',
    },
  };

  // 5th arg false = don't block startup on facilitator sync
  app.use(paymentMiddleware(routes, resourceServer, undefined, undefined, false));

  // Protected handler - only runs AFTER middleware verifies payment
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

  x402Ready = true;
  console.log('[v0] x402 middleware registered for GET /download');
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

app.listen(PORT, () => {
  console.log(`[v0] Server listening on 0.0.0.0:${PORT}`);
  console.log(`[v0] x402 ready: ${x402Ready}`);
});

// Keep the process alive
process.on('unhandledRejection', (err) => {
  console.error('[v0] Unhandled rejection (ignored to stay alive):', err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('[v0] Uncaught exception (ignored to stay alive):', err?.message || err);
});
