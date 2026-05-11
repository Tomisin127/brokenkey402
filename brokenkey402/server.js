import 'dotenv/config';
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { bazaarResourceServerExtension, declareDiscoveryExtension } from '@x402/extensions/bazaar';

const app = express();
app.use(express.json());

const PAY_TO = process.env.PAY_TO?.trim();
const NETWORK = "eip155:8453";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.xpay.sh",   // ← No key needed
});

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme())
  .registerExtension(bazaarResourceServerExtension);

const routes = {
  "GET /download": {
    accepts: [{
      scheme: "exact",
      network: NETWORK,
      amount: "10000000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: PAY_TO,
      maxTimeoutSeconds: 300,
    }],
    description: "Broken Key Remapper Full Software Download",
    mimeType: "application/json",
    extensions: { ...declareDiscoveryExtension({ input: {}, output: { example: {} } }) }
  }
};

app.use(paymentMiddleware(routes, resourceServer));

app.get('/download', (req, res) => {
  res.json({ success: true, downloadLink: "https://drive.google.com/..." });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Running on ${PORT}`));
