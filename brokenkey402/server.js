const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();

// Load env vars (helpful for local testing too)
require('dotenv').config();

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x402-*, authorization');
  next();
});

// ====================== CONFIG ======================
const PAY_TO = process.env.PAY_TO || "0xB91504d6F77d36923376c302cCC0237dF0efAa35";
const PRICE = process.env.PRICE || "$0.01";
const NETWORK = process.env.NETWORK || "base"; // "base" or "eip155:8453"
const DOWNLOAD_LINK = process.env.DOWNLOAD_LINK || "https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk";

// CDP Facilitator (Coinbase)
const FACILITATOR = {
  url: "https://api.cdp.coinbase.com/platform/v2/x402",
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
};

// Safety check
if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
  console.error("❌ Missing CDP_API_KEY_ID or CDP_API_KEY_SECRET environment variables!");
  console.error("Please add them in Railway Dashboard → Variables");
}

// ====================== ROUTES ======================

// Public root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'BrokenKeyRemapper x402 API',
    status: 'online',
    description: 'Purchase BrokenKeyRemapper using USDC on Base via x402.',
    purchaseEndpoint: '/download',
    method: 'POST',
    price: PRICE,
    network: NETWORK,
    payTo: PAY_TO
  });
});

app.use(
  paymentMiddleware(
    {
      "POST /download": {
        price: PRICE,
        network: NETWORK,
        payTo: PAY_TO,
        config: {
          description: "Broken Key Remapper Full Software Download",
          mimeType: "application/json",
        }
      }
    },
    FACILITATOR
  )
);

// Protected download endpoint
app.post('/download', (req, res) => {
  console.log("✅ Payment successful from:", req.x402Payment?.payer || req.x402Payment?.wallet || "unknown");

  res.json({
    success: true,
    message: "Thank you for your purchase!",
    downloadLink: DOWNLOAD_LINK,
    expiresIn: "24 hours",
    version: "1.2",
    instructions: "Download, extract, and run BrokenKeyRemapper.exe (Windows) or the equivalent for your OS."
  });
});

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BrokenKeyRemapper x402 server running on port ${PORT}`);
  console.log(`💰 Protected endpoint: POST /download → Price: ${PRICE} on ${NETWORK}`);
});
