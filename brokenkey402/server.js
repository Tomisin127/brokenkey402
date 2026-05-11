import 'dotenv/config';
import express from 'express';

import {
  paymentMiddleware,
  ResourceServer,
} from '@x402/express';

import { ExactEvmScheme } from '@x402/evm';

import { HTTPFacilitatorClient } from '@x402/core';

import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from '@x402/extensions';

const app = express();
app.use(express.json());

// ====================== CORS ======================
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');

  // Handle browser preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// ====================== Config ======================
const PAY_TO = process.env.PAY_TO?.trim();
const NETWORK = 'eip155:8453'; // Base Mainnet
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID?.trim();
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET?.trim();

if (!PAY_TO) {
  throw new Error('PAY_TO environment variable is missing');
}

if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET) {
  throw new Error(
    'CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables are required'
  );
}

console.log('🚀 BrokenKeyRemapper x402 Mainnet');
console.log('🔗 Network:', NETWORK);
console.log('📍 PayTo:', PAY_TO);
console.log('🔑 CDP_API_KEY_ID:', CDP_API_KEY_ID ? '✅ Loaded' : '❌ Missing');
console.log(
  '🔑 CDP_API_KEY_SECRET:',
  CDP_API_KEY_SECRET ? '✅ Loaded' : '❌ Missing'
);

// ====================== Facilitator ======================
const facilitator = new HTTPFacilitatorClient({
  url: 'https://api.cdp.coinbase.com/platform/v2/x402',
  apiKeyId: CDP_API_KEY_ID,
  apiKeySecret: CDP_API_KEY_SECRET,
});

// ====================== Resource Server ======================
const resourceServer = new ResourceServer(facilitator)
  .register(NETWORK, new ExactEvmScheme())
  .registerExtension(bazaarResourceServerExtension);

// ====================== Protected Routes ======================
const protectedRoutes = {
  'GET /download': {
    accepts: [
      {
        scheme: 'exact',
        network: NETWORK,
        amount: '10000000', // 10 USDC (6 decimals)
        asset: USDC_BASE,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
      },
    ],
    description: 'Broken Key Remapper Full Software Download',
    mimeType: 'application/json',
    extensions: {
      ...declareDiscoveryExtension({
        input: {
          broken_text: 'test input',
        },
        output: {
          example: {
            success: true,
            downloadLink:
              'https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk',
          },
        },
      }),
    },
  },
};

// ====================== Payment Middleware ======================
app.use(paymentMiddleware(protectedRoutes, resourceServer));

// ====================== Paid Endpoint ======================
app.get('/download', (req, res) => {
  res.json({
    success: true,
    message: 'Payment verified - thank you!',
    downloadLink:
      'https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk',
  });
});

// ====================== Health Check ======================
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BrokenKeyRemapper x402 API',
    network: NETWORK,
    endpoint: '/download',
    price: '10 USDC on Base Mainnet',
  });
});

// ====================== 404 Handler ======================
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    hint: 'Use GET /download',
  });
});

// ====================== Start Server ======================
const PORT = Number(process.env.PORT || 8080);

app.listen(PORT, () => {
  console.log(`🚀 Listening on port ${PORT}`);
});
