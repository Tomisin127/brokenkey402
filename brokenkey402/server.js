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

// === MAINNET CONFIG - ALL HARDCODED ===
const PAY_TO = "0xc0887adf2411c4db859e497c1f931c59600b1ec4";           // ← CHANGE TO YOUR REAL BASE WALLET
const PRICE = "$0.01";                                 // ← Change price (e.g. "$0.05", "$0.25")
const NETWORK = "base";                                // or "base-mainnet" / "8453" — try "base" first
const FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

// Your CDP credentials (from https://cdp.coinbase.com)
const CDP_API_KEY_ID = "df19051d-3e96-4b9a-9171-5540a16fcbee";     // ← PASTE YOUR KEY ID
const CDP_API_KEY_SECRET = "B+VFaTzVdUHvaQa5Ag2ghFnT4mGWE+/lvldhM2pk5qKcXdw/9Po85hQGhyEjXtBvszD/PGtph6YrLw30KeX/Vw=="; // ← PASTE YOUR SECRET

// Your software download link (update this!)
const DOWNLOAD_LINK = "https://drive.google.com/file/d/1dCFyioeR_ST0OF1gZZzPXGn82U7Q-Vvp/view?usp=drivesdk";  // ← CHANGE TO REAL LINK

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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 BrokenKeyRemapper x402 server running on http://localhost:${PORT}`);
  console.log(`💰 Protected endpoint: POST /download  →  Price: ${PRICE} on Base Mainnet`);