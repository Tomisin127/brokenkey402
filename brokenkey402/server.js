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

// === CONFIG ===
const PAY_TO = "0xB91504d6F77d36923376c302cCC0237dF0efAa35";
const PRICE = "$0.01";
const NETWORK = "eip155:8453";        // Base Mainnet
const FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

const CDP_API_KEY_ID = "df19051d-3e96-4b9a-9171-5540a16fcbee";
const CDP_API_KEY_SECRET = "B+VFaTzVdUHvaQa5Ag2ghFnT4mGWE+/lvldhM2pk5qKcXdw/9Po85hQGhyEjXtBvszD/PGtph6YrLw30KeX/Vw==";

const DOWNLOAD_LINK = "https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk";

// === Proper CDP Bearer Token Auth ===
const createCDPAuthHeaders = async () => {
  // Create JWT-style Bearer token for CDP
  const credentials = Buffer.from(`\( {CDP_API_KEY_ID}: \){CDP_API_KEY_SECRET}`).toString('base64');
  
  return {
    Authorization: `Bearer ${credentials}`,   // CDP expects Bearer
  };
};

const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
  createAuthHeaders: createCDPAuthHeaders,
});

// === x402 Setup ===
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
  console.log(`🚀 BrokenKeyRemapper x402 v2 server running on port ${PORT}`);
  console.log(`💰 Protected: GET /download → ${PRICE} on Base Mainnet`);
});
