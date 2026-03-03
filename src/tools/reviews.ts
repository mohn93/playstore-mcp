import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gpGet, gpPost } from "../client/api-client.js";
import type { Review } from "../types/play-api.js";

interface ReviewsListResponse {
  reviews?: Review[];
  tokenPagination?: { nextPageToken?: string };
}

export function registerReviewsTools(server: McpServer): void {
  server.tool(
    "list_reviews",
    "List user reviews for a Google Play app",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
      maxResults: z.number().min(1).max(100).optional()
        .describe("Maximum number of reviews to return (default 20)"),
      token: z.string().optional()
        .describe("Pagination token from a previous request"),
    },
    async ({ packageName, maxResults, token }) => {
      const params: Record<string, string> = {};
      if (maxResults) params.maxResults = String(maxResults);
      if (token) params.token = token;

      const response = await gpGet<ReviewsListResponse>(
        `/${packageName}/reviews`,
        params
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              reviews: (response.reviews ?? []).map((r) => {
                const userComment = r.comments?.[0]?.userComment;
                return {
                  reviewId: r.reviewId,
                  author: r.authorName,
                  rating: userComment?.starRating,
                  text: userComment?.text,
                  language: userComment?.reviewerLanguage,
                  appVersionName: userComment?.appVersionName,
                  thumbsUp: userComment?.thumbsUpCount,
                  thumbsDown: userComment?.thumbsDownCount,
                };
              }),
              nextPageToken: response.tokenPagination?.nextPageToken,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "reply_to_review",
    "Reply to a user review on Google Play",
    {
      packageName: z.string().describe("Android package name (e.g. com.example.app)"),
      reviewId: z.string().describe("The review ID to reply to"),
      replyText: z.string().describe("Your reply text"),
    },
    async ({ packageName, reviewId, replyText }) => {
      await gpPost(
        `/${packageName}/reviews/${reviewId}:reply`,
        { replyText }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ message: "Reply posted successfully" }, null, 2),
          },
        ],
      };
    }
  );
}
