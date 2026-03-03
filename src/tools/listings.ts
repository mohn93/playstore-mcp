import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gpGet, gpPut, withEditSession } from "../client/api-client.js";
import type { Listing } from "../types/play-api.js";

interface ListingsListResponse {
  kind: string;
  listings?: Listing[];
}

export function registerListingsTools(server: McpServer): void {
  server.tool(
    "list_listings",
    "List all store listings (all locales) for an app",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
    },
    async ({ packageName }) => {
      const response = await withEditSession(packageName, (editId) =>
        gpGet<ListingsListResponse>(`/${packageName}/edits/${editId}/listings`)
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              listings: (response.listings ?? []).map((l) => ({
                language: l.language,
                title: l.title,
                shortDescription: l.shortDescription,
                fullDescription: l.fullDescription,
              })),
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_listing",
    "Get store listing for a specific locale",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
      language: z.string().describe("BCP 47 language code (e.g. en-US, ja-JP)"),
    },
    async ({ packageName, language }) => {
      const listing = await withEditSession(packageName, (editId) =>
        gpGet<Listing>(`/${packageName}/edits/${editId}/listings/${language}`)
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              language: listing.language,
              title: listing.title,
              shortDescription: listing.shortDescription,
              fullDescription: listing.fullDescription,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "update_listing",
    "Update store listing for a specific locale",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
      language: z.string().describe("BCP 47 language code (e.g. en-US, ja-JP)"),
      title: z.string().optional().describe("App title (max 30 chars)"),
      shortDescription: z.string().optional().describe("Short description (max 80 chars)"),
      fullDescription: z.string().optional().describe("Full description (max 4000 chars)"),
    },
    async ({ packageName, language, title, shortDescription, fullDescription }) => {
      const body: Record<string, string> = { language };
      if (title) body.title = title;
      if (shortDescription) body.shortDescription = shortDescription;
      if (fullDescription) body.fullDescription = fullDescription;

      const listing = await withEditSession(
        packageName,
        (editId) => gpPut<Listing>(`/${packageName}/edits/${editId}/listings/${language}`, body),
        { commit: true }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              message: "Listing updated successfully",
              listing: {
                language: listing.language,
                title: listing.title,
                shortDescription: listing.shortDescription,
                fullDescription: listing.fullDescription,
              },
            }, null, 2),
          },
        ],
      };
    }
  );
}
