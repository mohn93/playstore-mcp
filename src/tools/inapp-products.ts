import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gpGet } from "../client/api-client.js";
import type { InAppProduct } from "../types/play-api.js";

interface InAppProductsListResponse {
  inappproduct?: InAppProduct[];
  tokenPagination?: { nextPageToken?: string };
}

function formatProduct(p: InAppProduct): Record<string, unknown> {
  return {
    sku: p.sku,
    status: p.status,
    purchaseType: p.purchaseType,
    defaultPrice: p.defaultPrice,
    defaultLanguage: p.defaultLanguage,
  };
}

export function registerInAppProductsTools(server: McpServer): void {
  server.tool(
    "list_inapp_products",
    "List in-app products (managed products) for an app",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
      maxResults: z.number().min(1).max(100).optional()
        .describe("Maximum number of products to return"),
      token: z.string().optional()
        .describe("Pagination token from a previous request"),
    },
    async ({ packageName, maxResults, token }) => {
      const params: Record<string, string> = {};
      if (maxResults) params.maxResults = String(maxResults);
      if (token) params.token = token;

      const response = await gpGet<InAppProductsListResponse>(
        `/${packageName}/inappproducts`,
        params
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              products: (response.inappproduct ?? []).map(formatProduct),
              nextPageToken: response.tokenPagination?.nextPageToken,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_inapp_product",
    "Get details of a specific in-app product",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
      sku: z.string().describe("The in-app product SKU"),
    },
    async ({ packageName, sku }) => {
      const product = await gpGet<InAppProduct>(
        `/${packageName}/inappproducts/${sku}`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(formatProduct(product), null, 2),
          },
        ],
      };
    }
  );
}
