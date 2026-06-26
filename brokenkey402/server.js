import 'dotenv/config';
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { BUILDER_CODE, declareBuilderCodeExtension } from '@x402/extensions/builder-code';

const app = express();
app.use(express.json());

// Logging + CORS (unchanged - keep your existing blocks) ...

// ====================== Config ======================
const PAY_TO = process.env.PAY_TO?.trim();
const PRICE = '$0.01';
const NETWORK = 'eip155:8453'; // Base Mainnet

const FACILITATOR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID?.trim();
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET?.trim();

const BUILDER_CODE_VALUE = process.env.BUILDER_CODE?.trim();

const DRIVE_FILE_ID = '1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp';
const DOWNLOAD_LINK = `https://drive.google.com/uc?export=download&id=${DRIVE_FILE_ID}`;

const PORT = Number(process.env.PORT) || 8080;

const missing = [];
if (!PAY_TO) missing.push('PAY_TO');
if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET) missing.push('CDP_API_KEY_ID / CDP_API_KEY_SECRET');
if (!BUILDER_CODE_VALUE) console.warn('⚠️ BUILDER_CODE missing');

// ====================== Health ======================
let x402Ready = false;
let initError = null;

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BrokenKeyRemapper x402',
    facilitator: FACILITATOR_URL,
    builderCode: BUILDER_CODE_VALUE || 'NONE',
    x402Ready,
    initError: initError ? String(initError) : null,
  });
});

// ====================== x402 Setup ======================
async function setupX402() {
  if (missing.length > 0) {
    throw new Error(`Missing env: ${missing.join(', ')}`);
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
    createAuthHeaders: async () => ({
      Authorization: `Bearer \( {CDP_API_KEY_ID}: \){CDP_API_KEY_SECRET}`,
    }),
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    NETWORK,
    new ExactEvmScheme()
  );

  console.log('[v0] Initializing CDP facilitator...');
  await resourceServer.initialize();
  console.log('[v0] ✅ CDP facilitator initialized');

  const routes = {
    'GET /download': {
      accepts: [{
        scheme: 'exact',
        price: PRICE,
        network: NETWORK,
        payTo: PAY_TO,
        maxTimeoutSeconds: 60,
      }],
      description: 'Broken Key Remapper Full Software Download',
      mimeType: 'application/json',
      extensions: {
        [BUILDER_CODE]: declareBuilderCodeExtension(BUILDER_CODE_VALUE),
      },
    },
  };

  app.use(paymentMiddleware(routes, resourceServer));

  app.get('/download', (req, res) => {
    const payer = req.x402Payment?.payer || 'unknown';
    console.log('[v0] Payment verified for:', payer);
    res.json({
      success: true,
      downloadLink: DOWNLOAD_LINK,
      expiresIn: '24 hours',
      version: '1.2',
    });
  });
}

// ====================== Boot ======================
async function main() {
  try {
    await setupX402();
    x402Ready = true;
    console.log('[v0] ✅ Server ready with CDP');
  } catch (err) {
    initError = err;
    console.error('[v0] ❌ Init failed:', err.message);
  }

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[v0] Listening on :${PORT}`);
  });
}

main().catch(console.error);
