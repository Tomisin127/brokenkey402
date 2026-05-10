const express = require('express');
const { paymentMiddleware } = require('x402-express');

const app = express();
app.use(express.json());

// CORS - allows calls from your brokenkeyremapper.xyz website
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x402-*');
  next();
});

// === CONFIG - loaded from environment variables ===
const PAY_TO = process.env.PAY_TO || "0xB91504d6F77d36923376c302cCC0237dF0efAa35";
const PRICE = process.env.PRICE || "$0.01";
const NETWORK = "base";                                // or "base-mainnet" / "8453" — try "base" first
const FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

// Your CDP credentials — set these as Railway environment variables
const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;

// Your software download link
const DOWNLOAD_LINK = process.env.DOWNLOAD_LINK || "https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk";


// x402 payment middleware configuration
app.use(
  paymentMiddleware(
    PAY_TO,   // receiving wallet
    {
      "POST /download": {
        price: PRICE,
        network: NETWORK,
        config: {
          description: "Broken Key Remapper Full Software Download",
          mimeType: "application/json",
        }
      }
    },
    {
      url: FACILITATOR_URL,
      apiKeyId: CDP_API_KEY_ID,
      apiKeySecret: CDP_API_KEY_SECRET
    }
  )
);

// The protected endpoint - returns download link after successful payment
app.post('/download', (req, res) => {
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
  console.log(`🚀 BrokenKeyRemapper x402 server running on http://localhost:${PORT}`);
  console.log(`💰 Protected endpoint: POST /download  →  Price: ${PRICE} on Base Mainnet`);
});
