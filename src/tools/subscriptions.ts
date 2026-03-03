import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gpGet } from "../client/api-client.js";
import type { Subscription } from "../types/play-api.js";

interface SubscriptionsListResponse {
  subscriptions?: Subscription[];
  nextPageToken?: string;
}

function formatSubscription(s: Subscription): Record<string, unknown> {
  return {
    productId: s.productId,
    basePlans: s.basePlans?.map((bp) => ({
      basePlanId: bp.basePlanId,
      state: bp.state,
      billingPeriod:
        bp.autoRenewingBasePlanType?.billingPeriodDuration ??
        bp.prepaidBasePlanType?.billingPeriodDuration,
    })),
    listings: s.listings?.map((l) => ({
      language: l.languageCode,
      title: l.title,
    })),
  };
}

export function registerSubscriptionsTools(server: McpServer): void {
  server.tool(
    "list_subscriptions",
    "List subscriptions for a Google Play app",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
      pageSize: z.number().min(1).max(100).optional()
        .describe("Number of subscriptions to return (default 50)"),
      pageToken: z.string().optional()
        .describe("Pagination token from a previous request"),
    },
    async ({ packageName, pageSize, pageToken }) => {
      const params: Record<string, string> = {};
      if (pageSize) params.pageSize = String(pageSize);
      if (pageToken) params.pageToken = pageToken;

      const response = await gpGet<SubscriptionsListResponse>(
        `/${packageName}/subscriptions`,
        params
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              subscriptions: (response.subscriptions ?? []).map(formatSubscription),
              nextPageToken: response.nextPageToken,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_subscription",
    "Get details of a specific subscription",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
      productId: z.string().describe("The subscription product ID"),
    },
    async ({ packageName, productId }) => {
      const subscription = await gpGet<Subscription>(
        `/${packageName}/subscriptions/${productId}`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(formatSubscription(subscription), null, 2),
          },
        ],
      };
    }
  );
}
