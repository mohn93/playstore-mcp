import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gpGet, gpPut } from "../client/api-client.js";
import type { Testers } from "../types/play-api.js";

export function registerTestersTools(server: McpServer): void {
  server.tool(
    "list_testers",
    "List testers for a specific track",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
      track: z.string().describe("Track name: production, beta, alpha, or internal"),
    },
    async ({ packageName, track }) => {
      const testers = await gpGet<Testers>(
        `/${packageName}/edits/-/testers/${track}`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              track,
              googleGroups: testers.googleGroups ?? [],
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "update_testers",
    "Update testers (Google Groups) for a specific track",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
      track: z.string().describe("Track name: production, beta, alpha, or internal"),
      googleGroups: z.array(z.string()).describe("List of Google Group email addresses"),
    },
    async ({ packageName, track, googleGroups }) => {
      const testers = await gpPut<Testers>(
        `/${packageName}/edits/-/testers/${track}`,
        { googleGroups }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              message: "Testers updated successfully",
              track,
              googleGroups: testers.googleGroups ?? [],
            }, null, 2),
          },
        ],
      };
    }
  );
}
