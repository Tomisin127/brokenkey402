import 'dotenv/config';

// FIX: unescape \n in PEM private key if Railway stored it as one line
if (process.env.CDP_API_KEY_SECRET?.includes('\\n')) {
  process.env.CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET.replace(/\\n/g, '\n');
  console.log("[v0] Unescaped \\n in CDP_API_KEY_SECRET");
}

import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { facilitator } from '@coinbase/x402';

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.header(
    'Access-Control-Expose-Headers',
    'PAYMENT-REQUIRED, X-PAYMENT-RESPONSE, x-payment-response, payment-required'
  );
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ====================== Config ======================
const PAY_TO = process.env.PAY_TO?.trim();
const PRICE = "$0.01";
const NETWORK = "eip155:8453"; // Base Mainnet

const DRIVE_FILE_ID = "1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp";
const DOWNLOAD_LINK = `https://drive.google.com/uc?export=download&id=${DRIVE_FILE_ID}`;

const PORT = Number(process.env.PORT) || 8080;

const missing = [];
if (!PAY_TO) missing.push("PAY_TO");
if (!process.env.CDP_API_KEY_ID) missing.push("CDP_API_KEY_ID");
if (!process.env.CDP_API_KEY_SECRET) missing.push("CDP_API_KEY_SECRET");

console.log("BrokenKeyRemapper x402 Mainnet");
console.log("Price:", PRICE);
console.log("Network:", NETWORK);
console.log("PayTo:", PAY_TO || "MISSING");
console.log("CDP_API_KEY_ID:", process.env.CDP_API_KEY_ID ? `set (${process.env.CDP_API_KEY_ID.slice(0, 8)}...)` : "MISSING");
console.log(
  "CDP_API_KEY_SECRET:",
  process.env.CDP_API_KEY_SECRET
    ? `set (${process.env.CDP_API_KEY_SECRET.length} chars, starts with "${process.env.CDP_API_KEY_SECRET.slice(0, 27)}")`
    : "MISSING"
);

// ====================== Health check ======================
app.get('/', (req, res) => {
  res.json({
    status: "ok",
    service: "BrokenKeyRemapper x402",
    network: NETWORK,
    price: PRICE,
    payTo: PAY_TO,
    endpoint: "/download",
    envOk: missing.length === 0,
    missingEnv: missing,
    cdpKeyLooksLikePem: process.env.CDP_API_KEY_SECRET?.includes('BEGIN') ?? false,
  });
});

// ====================== x402 Setup ======================
let x402Ready = false;

try {
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }

  const facilitatorClient = new HTTPFacilitatorClient(facilitator);

  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(NETWORK, new ExactEvmScheme());

  // accepts MUST be an array per the official x402 spec
  const routes = {
    "GET /download": {
      accepts: [
        {
          scheme: "exact",
          price: PRICE,
          network: NETWORK,
          payTo: PAY_TO,
        },
      ],
      description: "Broken Key Remapper Full Software Download",
      mimeType: "application/json",
    },
  };

  app.use(paymentMiddleware(routes, resourceServer));

  app.get('/download', (req, res) => {
    const payer = req.x402Payment?.payer || req.x402?.payment?.payer || "unknown";
    console.log("Payment verified from:", payer);

    res.json({
      success: true,
      message: "Thank you for your purchase!",
      downloadLink: DOWNLOAD_LINK,
      expiresIn: "24 hours",
      version: "1.2",
      instructions: "Download, extract, and run BrokenKeyRemapper.exe",
    });
  });

  x402Ready = true;
  console.log("x402 middleware registered for GET /download");
} catch (err) {
  console.error("Failed to initialize x402:", err);

  app.get('/download', (req, res) => {
    res.status(500).json({
      error: "x402 not initialized",
      reason: err instanceof Error ? err.message : String(err),
      missingEnv: missing,
    });
  });
}

// 404 (must be last)
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
    availableRoutes: ["GET /", "GET /download"],
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
  console.log(`x402 ready: ${x402Ready}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
