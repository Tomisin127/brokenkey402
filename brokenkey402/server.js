import express from "express";
import dotenv from "dotenv";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from "@x402/extensions/bazaar";

dotenv.config();

const app = express();
app.use(express.json());

// === MAINNET CONFIG ===
const PAY_TO = "0xB91504d6F77d36923376c302cCC0237dF0efAa35";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://api.cdp.coinbase.com/platform/v2/x402",   // ← Mainnet CDP
  // The SDK automatically uses these env vars for JWT auth:
  // CDP_API_KEY_ID
  // CDP_API_KEY_SECRET
});

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:8453", new ExactEvmScheme())           // Base Mainnet
  .registerExtension(bazaarResourceServerExtension);

// Route config (Bazaar ready)
const routes = {
  "GET /": {
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: "10000000",                  // 0.01 USDC
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
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
          max_suggestions: 3,
        },
        inputSchema: { /* your input schema from before */ },
        output: {
          example: { /* your output example */ }
        }
      })
    }
  }
};

app.use(paymentMiddleware(routes, resourceServer));

// Your handler
app.get("/", async (req, res) => {
  const brokenText = req.query.broken_text || req.body?.broken_text || "";
  // Your real remapping logic here...
  res.json({
    corrected_text: brokenText,
    original_input: brokenText,
    confidence: 0.92,
    explanation: "AI remapping applied.",
    alternative_suggestions: []
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
