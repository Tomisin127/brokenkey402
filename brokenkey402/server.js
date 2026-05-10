const express = require('express');
const { paymentMiddleware, x402ResourceServer } = require('@x402/express');
const { HTTPFacilitatorClient } = require('@x402/core/server');
const { ExactEvmScheme } = require('@x402/evm/exact/server');

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x402-*, payment-signature, payment-required');
  next();
});

// === MAINNET CONFIG ===
const PAY_TO = "0xB91504d6F77d36923376c302cCC0237dF0efAa35";
const PRICE = "$0.01";
const NETWORK = "eip155:8453";           // Base Mainnet (CAIP-2 format)
const FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

const DOWNLOAD_LINK = "https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk";

// Setup x402 v2 Resource Server
const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
});

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme());   // Register EVM exact payment scheme

// Protected route config for v2
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

// Apply x402 v2 middleware
app.use(
  paymentMiddleware(
    routes,
    resourceServer
    // You can add paywallConfig here later if you want a nice UI
  )
);

// Protected endpoint
app.get('/download', (req, res) => {
  console.log("✅ Payment received from:", req.x402Payment?.payer || req.x402Payment?.wallet || "unknown");

  res.json({
    success: true,
    message: "Thank you for your purchase!",
    downloadLink: DOWNLOAD_LINK,
    expiresIn: "24 hours",
    version: "1.2",
    instructions: "Download, extract, and run BrokenKeyRemapper.exe (Windows) or the equivalent for your OS."
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 BrokenKeyRemapper x402 v2 server running on port ${PORT}`);
  console.log(`💰 Protected endpoint: GET /download → ${PRICE} on Base`);
});        
    
