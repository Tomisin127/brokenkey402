import 'dotenv/config';
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// ====================== TESTNET CONFIG ======================
const PAY_TO = process.env.PAY_TO?.trim();
const PRICE = "$0.01";
const NETWORK = "eip155:84532";                    // Base Sepolia (Testnet)
const FACILITATOR_URL = "https://x402.org/facilitator";   // Free, no auth needed

const DOWNLOAD_LINK = "https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk";

console.log("🚀 Using Testnet Facilitator (no API key needed)");
console.log("💰 PAY_TO:", PAY_TO || "❌ MISSING");

// ====================== x402 Setup ======================
const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
  // No createAuthHeaders needed for x402.org
});

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

app.use(paymentMiddleware(routes, resourceServer));

// Protected Route
app.get('/download', (req, res) => {
  console.log("✅ Payment received from:", req.x402Payment?.payer || "unknown");
  res.json({
    success: true,
    message: "Thank you for your purchase! (Testnet)",
    downloadLink: DOWNLOAD_LINK,
    expiresIn: "24 hours",
    version: "1.2"
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BrokenKeyRemapper x402 TESTNET running on port ${PORT}`);
  console.log(`   Network : ${NETWORK} (Base Sepolia)`);
  console.log(`   Price   : ${PRICE}`);
});
