require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');                    // ← Add this
const { paymentMiddleware, x402ResourceServer } = require('@x402/express');
const { HTTPFacilitatorClient } = require('@x402/core/server');
const { ExactEvmScheme } = require('@x402/evm/exact/server');

const app = express();
app.use(express.json());

// CORS (same as before)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x402-*, payment-signature, payment-required');
  next();
});

// Config
const PAY_TO = process.env.PAY_TO;
const PRICE = "$0.01";
const NETWORK = "eip155:8453";                    // Base Mainnet
const FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;

const DOWNLOAD_LINK = "https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk";

// Proper JWT for Coinbase CDP
const createCDPAuthHeaders = async () => {
  const payload = {
    iss: CDP_API_KEY_ID,
    aud: FACILITATOR_URL,
    exp: Math.floor(Date.now() / 1000) + 300,   // 5 minutes
  };

  const token = jwt.sign(payload, CDP_API_KEY_SECRET, { algorithm: 'HS256' });

  return {
    Authorization: `Bearer ${token}`,
  };
};

const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
  createAuthHeaders: createCDPAuthHeaders,
});

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme());

const routes = {
  "GET /download": {
    accepts: {
      scheme: "exact",
      price: PRICE,
      network: NETWORK,
      payTo: PAY_TO,
    },
    description: "Broken Key Remapper Full Software Download",
    mimeType: "application/json",
  }
};

app.use(paymentMiddleware(routes, resourceServer));

app.get('/download', (req, res) => {
  console.log("✅ Payment received from:", req.x402Payment?.payer || req.x402Payment?.wallet || "unknown");
  res.json({
    success: true,
    message: "Thank you for your purchase!",
    downloadLink: DOWNLOAD_LINK,
    expiresIn: "24 hours",
    version: "1.2",
    instructions: "Download, extract, and run BrokenKeyRemapper.exe"
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 x402 v2 server running on port ${PORT} (Mainnet)`);
});
