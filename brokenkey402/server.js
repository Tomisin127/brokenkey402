import 'dotenv/config';
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
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ====================== Config ======================
const PAY_TO = process.env.PAY_TO?.trim();
const PRICE = "$0.01";
const NETWORK = "eip155:8453"; // Base Mainnet

// Google Drive direct-download format (NOT /view)
const DRIVE_FILE_ID = "1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp";
const DOWNLOAD_LINK = `https://drive.google.com/uc?export=download&id=${DRIVE_FILE_ID}`;

console.log("🚀 BrokenKeyRemapper x402 Mainnet");
console.log("💰 Price:", PRICE);
console.log("🔗 Network:", NETWORK);
console.log("📍 PayTo:", PAY_TO || "❌ MISSING");
console.log("🔑 CDP_API_KEY_ID:", process.env.CDP_API_KEY_ID ? "✅ set" : "❌ MISSING");
console.log("🔑 CDP_API_KEY_SECRET:", process.env.CDP_API_KEY_SECRET ? "✅ set" : "❌ MISSING");

// Validate critical env vars BEFORE doing anything else
const missing = [];
if (!PAY_TO) missing.push("PAY_TO");
if (!process.env.CDP_API_KEY_ID) missing.push("CDP_API_KEY_ID");
if (!process.env.CDP_API_KEY_SECRET) missing.push("CDP_API_KEY_SECRET");

const PORT = Number(process.env.PORT) || 8080;

// Health check FIRST so Railway always gets a 200 at /
app.get('/', (req, res) => {
  res.json({
    status: "ok",
    service: "BrokenKeyRemapper x402",
    network: NETWORK,
    price: PRICE,
    endpoint: "/download",
    envOk: missing.length === 0,
    missingEnv: missing,
  });
});

// ====================== x402 Setup ======================
// Wrap in try/catch so a facilitator init failure doesn't kill the process
try {
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }

  const facilitatorClient = new HTTPFacilitatorClient(facilitator);

  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(NETWORK, new ExactEvmScheme());

  const routes = {
    "GET /download": {
      accepts: [{
        scheme: "exact",
        price: PRICE,
        network: NETWORK,
        payTo: PAY_TO,
      }],
      description: "Broken Key Remapper Full Software Download",
      mimeType: "application/json",
    },
  };

  // 5th arg = syncFacilitatorOnStart: false -> don't crash if CDP is slow/unreachable at boot
  app.use(paymentMiddleware(routes, resourceServer, undefined, undefined, false));

  // Protected endpoint
  app.get('/download', (req, res) => {
    console.log("✅ Payment verified, serving download");
    res.json({
      success: true,
      message: "Thank you for your purchase!",
      downloadLink: DOWNLOAD_LINK,
      expiresIn: "24 hours",
      version: "1.2",
      instructions: "Download, extract, and run BrokenKeyRemapper.exe",
    });
  });

  console.log("✅ x402 middleware registered for GET /download");
} catch (err) {
  console.error("❌ Failed to initialize x402:", err);

  // Fail-soft: app still boots so Railway sees a healthy port,
  // but /download tells you exactly what's wrong instead of 404-ing.
  app.get('/download', (req, res) => {
    res.status(500).json({
      error: "x402 not initialized",
      reason: err instanceof Error ? err.message : String(err),
      missingEnv: missing,
    });
  });
}

// Catch-all LAST
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
    availableRoutes: ["GET /", "GET /download"],
  });
});

// Bind explicitly to 0.0.0.0 for Railway
app.listen(PORT, () => {
  console.log(`🚀 Server listening on 0.0.0.0:${PORT}`);
});
