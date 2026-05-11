import 'dotenv/config';
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { facilitator } from '@coinbase/x402';

const app = express();
app.use(express.json());

// ====================== CORS (expose x402 headers!) ======================
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  // CRITICAL: browsers/clients must be able to READ these x402 headers
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

// Google Drive DIRECT download URL (not /view)
const DRIVE_FILE_ID = "1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp";
const DOWNLOAD_LINK = `https://drive.google.com/uc?export=download&id=${DRIVE_FILE_ID}`;

const PORT = Number(process.env.PORT) || 8080;

// Validate env BEFORE doing anything fragile
const missing = [];
if (!PAY_TO) missing.push("PAY_TO");
if (!process.env.CDP_API_KEY_ID) missing.push("CDP_API_KEY_ID");
if (!process.env.CDP_API_KEY_SECRET) missing.push("CDP_API_KEY_SECRET");

console.log("BrokenKeyRemapper x402 Mainnet");
console.log("Price:", PRICE);
console.log("Network:", NETWORK);
console.log("PayTo:", PAY_TO || "MISSING");
console.log("CDP_API_KEY_ID:", process.env.CDP_API_KEY_ID ? "set" : "MISSING");
console.log("CDP_API_KEY_SECRET:", process.env.CDP_API_KEY_SECRET ? "set" : "MISSING");

// ====================== Health check (must be BEFORE 404 handler) ======================
// Railway pings "/" to verify the service is alive
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

  // CRITICAL FIX: `accepts` is a SINGLE OBJECT in v2, not an array
  const routes = {
    "GET /download": {
      accepts: {
        scheme: "exact",
        price: PRICE,
        network: NETWORK,
        payTo: PAY_TO,
        maxTimeoutSeconds: 60,
      },
      description: "Broken Key Remapper Full Software Download",
      mimeType: "application/json",
    },
  };

  // Payment middleware MUST be registered BEFORE the protected route handler
  // and BEFORE any auth middleware
  app.use(paymentMiddleware(routes, resourceServer));

  // ====================== Protected Endpoint ======================
  app.get('/download', (req, res) => {
    const payer =
      req.x402Payment?.payer ||
      req.x402?.payment?.payer ||
      "unknown";
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

  // Fail-soft: keep the server alive so Railway healthchecks pass
  // and so /download tells you exactly what's broken instead of crashing the container
  app.get('/download', (req, res) => {
    res.status(500).json({
      error: "x402 not initialized",
      reason: err instanceof Error ? err.message : String(err),
      missingEnv: missing,
    });
  });
}

// ====================== 404 handler (MUST be last) ======================
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
    availableRoutes: ["GET /", "GET /download"],
  });
});

// ====================== Start server ======================
// Bind to 0.0.0.0 for Railway / Docker
app.listen(PORT, () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
  console.log(`x402 ready: ${x402Ready}`);
  console.log(`Test: curl -i https://api.brokenkeyremapper.xyz/download`);
});

// Don't let unhandled errors silently kill the process
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
