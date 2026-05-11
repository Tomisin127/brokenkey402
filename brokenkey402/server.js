import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { 
  bazaarResourceServerExtension, 
  declareDiscoveryExtension 
} from "@x402/extensions/bazaar";

// === CONFIG ===
const app = express();
app.use(express.json());

const PAY_TO = "0xB91504d6F77d36923376c302cCC0237dF0efAa35"; // Your receiving address
const FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402"; // CDP for Bazaar indexing

const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
  // Add your CDP API keys here if required for production:
  // apiKey: process.env.CDP_API_KEY,
  // apiSecret: process.env.CDP_API_SECRET,
});

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:8453", new ExactEvmScheme())     // Base mainnet
  // .register("eip155:84532", new ExactEvmScheme()) // Base Sepolia for testing
  .registerExtension(bazaarResourceServerExtension);   // ← Critical for Bazaar

// Define your paid route(s)
const routes = {
  "GET /": {   // or whatever your actual route is (e.g. "GET /remap")
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",           // Base mainnet (recommended)
        amount: "10000000",               // 0.01 USDC (6 decimals)
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
      },
    ],
    description: "BrokenKeyRemapper.xyz helps you type anything on a broken keyboard",
    mimeType: "application/json",
    extensions: {
      ...declareDiscoveryExtension({
        input: {
          broken_text: "Th3 qu1ck br0wn f0x jump5 0v3r th3 l4zy d0g",
          context: "English pangram",
          max_suggestions: 3
        },
        // You can also pass inputSchema if you want stricter validation
        output: {
          example: {
            corrected_text: "The quick brown fox jumps over the lazy dog",
            original_input: "Th3 qu1ck br0wn f0x jump5 0v3r th3 l4zy d0g",
            confidence: 0.94,
            explanation: "Remapped common broken-key substitutions based on English context.",
            alternative_suggestions: ["The quick brown fox jumps over the lazy dog."]
          },
          // Optional: full JSON schema (the helper can infer a lot)
        }
      })
    }
  }
};

// Apply x402 middleware **before** your routes and any auth
app.use(paymentMiddleware(routes, resourceServer));

// Your actual handler (only reached after successful payment)
app.get("/", (req, res) => {
  const brokenText = req.query.broken_text || req.body?.broken_text;
  // ... your remapping logic here ...
  res.json({
    corrected_text: "...",
    original_input: brokenText,
    confidence: 0.95,
    explanation: "...",
    alternative_suggestions: []
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ x402 endpoint running on http://localhost:${PORT}`);
  console.log(`💰 Pay-to: ${PAY_TO}`);
});
