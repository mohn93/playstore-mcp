#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAppsTools } from "./tools/apps.js";
import { registerTracksTools } from "./tools/tracks.js";
import { registerReviewsTools } from "./tools/reviews.js";
import { registerListingsTools } from "./tools/listings.js";
import { registerInAppProductsTools } from "./tools/inapp-products.js";
import { registerSubscriptionsTools } from "./tools/subscriptions.js";
import { registerTestersTools } from "./tools/testers.js";

const server = new McpServer({
  name: "playstore",
  version: "1.0.0",
});

// Register all tool modules
registerAppsTools(server);
registerTracksTools(server);
registerReviewsTools(server);
registerListingsTools(server);
registerInAppProductsTools(server);
registerSubscriptionsTools(server);
registerTestersTools(server);

// Connect via stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Play Store MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
