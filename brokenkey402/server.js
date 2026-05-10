require('dotenv').config();
const express = require('express');
const { paymentMiddleware, x402ResourceServer } = require('@x402/express');
const { HTTPFacilitatorClient } = require('@x402/core/server');
const { ExactEvmScheme } = require('@x402/evm/exact/server');
const { generateJwt } = require('@coinbase/cdp-sdk/auth');

const app = express();
app.use(express.json());

// ====================== CORS ======================
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x402-*, payment-signature, payment-required, authorization');
  next();
});

// ====================== Config ======================
const PAY_TO = process.env.PAY_TO;                    // Your Base mainnet receiving address
const PRICE = "$0.01";
const NETWORK = "eip155:8453";                        // Base Mainnet
const FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;

const DOWNLOAD_LINK = "https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk";

// ====================== CDP JWT Auth ======================
const createCDPAuthHeaders = async () => {
  try {
    const token = await generateJwt({
      apiKeyId: CDP_API_KEY_ID,
      apiKeySecret: CDP_API_KEY_SECRET,
      requestMethod: "GET",
      requestHost: "api.cdp.coinbase.com",
      requestPath: "/platform/v2/x402/supported",   // Important for getSupported call
      expiresIn: 180,
    });

    return {
      Authorization: `Bearer ${token}`,
    };
  } catch (err) {
    console.error("❌ JWT generation failed:", err.message);
    throw err;
  }
};

// ====================== x402 Setup ======================
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

// Apply payment middleware
app.use(paymentMiddleware(routes, resourceServer));

// ====================== Protected Route ======================
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

// ====================== Start Server ======================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 BrokenKeyRemapper x402 v2 Mainnet server running on port ${PORT}`);
  console.log(`   PayTo: ${PAY_TO}`);
  console.log(`   Price: ${PRICE} on ${NETWORK}`);
});
