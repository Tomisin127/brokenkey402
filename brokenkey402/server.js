import 'dotenv/config';
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { facilitator } from '@coinbase/x402';   // Official CDP helper

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// ====================== Config ======================
const PAY_TO = process.env.PAY_TO?.trim();
const PRICE = "$0.01";
const NETWORK = "eip155:8453";   // Base Mainnet

const DOWNLOAD_LINK = "https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk";

console.log("🚀 BrokenKeyRemapper x402 Mainnet");
console.log("💰 Price:", PRICE);
console.log("🔗 Network:", NETWORK);
console.log("📍 PayTo:", PAY_TO || "❌ MISSING");

if (!PAY_TO) {
  console.error("❌ CRITICAL: PAY_TO environment variable is missing!");
  process.exit(1);
}

// ====================== x402 Setup (CDP Mainnet) ======================
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
  }
};

// 🔥 Middleware MUST be registered BEFORE any routes
app.use(paymentMiddleware(routes, resourceServer));

// ====================== Protected Endpoint ======================
app.get('/download', (req, res) => {
  console.log("✅ Payment verified from:", req.x402Payment?.payer || req.x402Payment?.wallet || "unknown");

  res.json({
    success: true,
    message: "Thank you for your purchase!",
    downloadLink: DOWNLOAD_LINK,
    expiresIn: "24 hours",
    version: "1.2",
    instructions: "Download, extract, and run BrokenKeyRemapper.exe"
  });
});

// Debug 404s
app.use((req, res) => {
  res.status(404).json({ 
    error: "Route not found", 
    path: req.path,
    method: req.method,
    tip: "Make sure you're hitting /download exactly"
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`→ Test endpoint: https://api.brokenkeyremapper.xyz/download`);
});
