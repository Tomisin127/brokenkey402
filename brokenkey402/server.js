import 'dotenv/config';
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from '@x402/extensions/bazaar';

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
const NETWORK = "eip155:8453";   // Base Mainnet

const DOWNLOAD_LINK = "https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk";

console.log("🚀 BrokenKeyRemapper x402 Mainnet");
console.log("🔗 Network:", NETWORK);
console.log("📍 PayTo:", PAY_TO || "❌ MISSING");

if (!PAY_TO) {
  console.error("❌ CRITICAL: PAY_TO environment variable is missing!");
  process.exit(1);
}

// ====================== x402 CDP Mainnet Setup ======================
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://api.cdp.coinbase.com/platform/v2/x402",
  // SDK will automatically read: CDP_API_KEY_ID and CDP_API_KEY_SECRET
});

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme())
  .registerExtension(bazaarResourceServerExtension);   // ← Important for Bazaar

// ====================== Route + Bazaar Discovery ======================
const routes = {
  "GET /download": {
    accepts: [{
      scheme: "exact",
      network: NETWORK,
      amount: "10000000",                    // 0.01 USDC (6 decimals)
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      payTo: PAY_TO,
      maxTimeoutSeconds: 300,
    }],
    description: "Broken Key Remapper Full Software Download",
    mimeType: "application/json",
    extensions: {
      ...declareDiscoveryExtension({
        input: {
          broken_text: "Th3 qu1ck br0wn f0x jump5 0v3r th3 l4zy d0g",
        },
        output: {
          example: {
            success: true,
            message: "Thank you for your purchase!",
            downloadLink: DOWNLOAD_LINK,
            expiresIn: "24 hours"
          }
        }
      })
    }
  }
};

// 🔥 This MUST be registered BEFORE your routes
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Route not found", 
    path: req.path,
    tip: "Make sure you're hitting /download exactly"
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`→ Test: https://api.brokenkeyremapper.xyz/download`);
});
