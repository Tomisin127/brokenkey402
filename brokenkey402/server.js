const express = require('express');
const { paymentMiddleware } = require('x402-express');

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x402-*');
  next();
});

// === MAINNET CONFIG ===
const PAY_TO = "0xB91504d6F77d36923376c302cCC0237dF0efAa35";
const PRICE = "$0.01";
const NETWORK = "base";
const FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

const CDP_API_KEY_ID = "df19051d-3e96-4b9a-9171-5540a16fcbee";
const CDP_API_KEY_SECRET = "B+VFaTzVdUHvaQa5Ag2ghFnT4mGWE+/lvldhM2pk5qKcXdw/9Po85hQGhyEjXtBvszD/PGtph6YrLw30KeX/Vw==";

const DOWNLOAD_LINK = "https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk";

// x402 payment middleware - Updated for GET
app.use(
  paymentMiddleware(
    PAY_TO,
    {
      "GET /download": { // ← Changed to GET
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

// Protected GET endpoint
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
  console.log(`🚀 BrokenKeyRemapper x402 server running on port ${PORT}`);
  console.log(`💰 Protected endpoint: GET /download → Price: ${PRICE} on ${NETWORK}`);
});
