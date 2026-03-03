import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gpGet, gpPost, gpDelete } from "../client/api-client.js";
import type { AppDetails } from "../types/play-api.js";

interface Edit {
  id: string;
  expiryTimeSeconds: string;
}

export function registerAppsTools(server: McpServer): void {
  server.tool(
    "get_app_details",
    "Get app details for a Google Play app by package name",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
    },
    async ({ packageName }) => {
      // Create a temporary edit session to access app details
      const edit = await gpPost<Edit>(`/${packageName}/edits`, {});
      try {
        const details = await gpGet<AppDetails>(
          `/${packageName}/edits/${edit.id}/details`
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ packageName, ...details }, null, 2),
            },
          ],
        };
      } finally {
        // Always clean up the edit session
        await gpDelete(`/${packageName}/edits/${edit.id}`).catch(() => {});
      }
    }
  );
}
