import 'dotenv/config';
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { BUILDER_CODE, declareBuilderCodeExtension } from '@x402/extensions/builder-code'; // ← NEW

const app = express();
app.use(express.json());

// ... (your existing logging, CORS, config, health check unchanged) ...

// ====================== Config ======================
const PAY_TO = process.env.PAY_TO?.trim();
const PRICE = '$0.01';
const NETWORK = 'eip155:8453'; // Base Mainnet (CAIP-2)

const FACILITATOR_URL = process.env.FACILITATOR_URL?.trim() || 'https://facilitator.payai.network';

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID?.trim();
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET?.trim();

const DRIVE_FILE_ID = '1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp';
const DOWNLOAD_LINK = `https://drive.google.com/uc?export=download&id=${DRIVE_FILE_ID}`;

const PORT = Number(process.env.PORT) || 8080;

// ====================== Builder Code (REQUIRED FOR ATTRIBUTION) ======================
const BUILDER_CODE_VALUE = process.env.BUILDER_CODE?.trim(); // e.g. bc_b7k3p9da

if (!BUILDER_CODE_VALUE) {
  console.warn('⚠️  BUILDER_CODE env var not set. Payments will not be attributed to your app on Base.');
}

// ====================== x402 Setup ======================
async function setupX402() {
  if (!PAY_TO) {
    throw new Error('Missing PAY_TO env var');
  }

  const isCDP = FACILITATOR_URL.includes('api.cdp.coinbase.com');

  const facilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
    ...(isCDP && CDP_API_KEY_ID && CDP_API_KEY_SECRET
      ? {
          headers: {
            Authorization: `Bearer \( {CDP_API_KEY_ID}: \){CDP_API_KEY_SECRET}`,
          },
        }
      : {}),
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    NETWORK,
    new ExactEvmScheme()
  );

  await resourceServer.initialize();

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
        [BUILDER_CODE]: declareBuilderCodeExtension(BUILDER_CODE_VALUE), // ← THIS ENABLES ATTRIBUTION
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

  console.log('[v0] x402 middleware registered with Builder Code:', BUILDER_CODE_VALUE || 'NONE');
}

// ... rest of your main() and error handlers unchanged ...

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
