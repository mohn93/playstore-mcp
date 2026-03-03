import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gpGet } from "../client/api-client.js";
import type { AppDetails } from "../types/play-api.js";

export function registerAppsTools(server: McpServer): void {
  server.tool(
    "get_app_details",
    "Get app details for a Google Play app by package name",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
    },
    async ({ packageName }) => {
      const details = await gpGet<AppDetails>(`/${packageName}`);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ packageName, ...details }, null, 2),
          },
        ],
      };
    }
  );
}
