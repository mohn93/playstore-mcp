import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gpGet } from "../client/api-client.js";
import type { Track } from "../types/play-api.js";

interface TracksListResponse {
  kind: string;
  tracks: Track[];
}

export function registerTracksTools(server: McpServer): void {
  server.tool(
    "list_tracks",
    "List all release tracks (production, beta, alpha, internal) for an app",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
    },
    async ({ packageName }) => {
      const response = await gpGet<TracksListResponse>(
        `/${packageName}/edits/-/tracks`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              tracks: (response.tracks ?? []).map((t) => ({
                track: t.track,
                releases: t.releases?.map((r) => ({
                  name: r.name,
                  status: r.status,
                  versionCodes: r.versionCodes,
                  userFraction: r.userFraction,
                })),
              })),
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_track",
    "Get details of a specific release track",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
      track: z.string().describe("Track name: production, beta, alpha, or internal"),
    },
    async ({ packageName, track }) => {
      const response = await gpGet<Track>(
        `/${packageName}/edits/-/tracks/${track}`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              track: response.track,
              releases: response.releases?.map((r) => ({
                name: r.name,
                status: r.status,
                versionCodes: r.versionCodes,
                userFraction: r.userFraction,
                releaseNotes: r.releaseNotes,
              })),
            }, null, 2),
          },
        ],
      };
    }
  );
}
