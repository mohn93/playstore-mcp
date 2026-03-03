# Play Store MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an MCP server that wraps Google's Android Publisher API v3, mirroring the architecture of `asc-mcp-server`.

**Architecture:** Stdio MCP server with modular tool registration. Google service account OAuth2 auth layer, generic HTTP client for androidpublisher v3, one tool module per API domain.

**Tech Stack:** TypeScript (ES2022, Node16 modules), `@modelcontextprotocol/sdk`, `google-auth-library`, `zod`

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

**Step 1: Initialize git repo**

```bash
cd /Users/mohn93/Desktop/side_projects/playstore-mcp
git init
```

**Step 2: Create `package.json`**

```json
{
  "name": "playstore-mcp",
  "version": "1.0.0",
  "description": "MCP server for Google Play Store — manage apps, releases, reviews, listings and more",
  "type": "module",
  "bin": {
    "playstore-mcp": "./build/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node build/index.js"
  },
  "files": [
    "build",
    "README.md"
  ],
  "keywords": [
    "mcp",
    "google-play",
    "play-store",
    "android",
    "playstore",
    "reviews",
    "releases"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mohn93/playstore-mcp.git"
  },
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1",
    "google-auth-library": "^9.15.1",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/node": "^25.3.3",
    "typescript": "^5.9.3"
  }
}
```

**Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 4: Create `.gitignore`**

```
node_modules/
build/
.env
*.json.key
```

**Step 5: Install dependencies**

```bash
npm install
```

**Step 6: Commit**

```bash
git add package.json tsconfig.json .gitignore package-lock.json
git commit -m "feat: initialize project scaffold"
```

---

### Task 2: Google OAuth2 auth module

**Files:**
- Create: `src/auth/google-auth.ts`

**Context:** Google service accounts use a JSON key file containing `client_email` and `private_key`. The `google-auth-library` `GoogleAuth` class handles token generation and caching automatically.

**Step 1: Create `src/auth/google-auth.ts`**

```typescript
import { GoogleAuth } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/androidpublisher"];

let authClient: GoogleAuth | null = null;

function getAuthClient(): GoogleAuth {
  if (authClient) return authClient;

  const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;

  if (!keyFilePath) {
    throw new Error(
      "Missing required environment variable: GOOGLE_SERVICE_ACCOUNT_KEY_PATH"
    );
  }

  authClient = new GoogleAuth({
    keyFilename: keyFilePath,
    scopes: SCOPES,
  });

  return authClient;
}

export async function getAccessToken(): Promise<string> {
  const auth = getAuthClient();
  const token = await auth.getAccessToken();

  if (!token) {
    throw new Error("Failed to obtain access token from Google service account");
  }

  return token;
}
```

**Step 2: Commit**

```bash
git add src/auth/google-auth.ts
git commit -m "feat: add Google service account OAuth2 auth module"
```

---

### Task 3: API client

**Files:**
- Create: `src/client/api-client.ts`

**Context:** The Android Publisher API base URL is `https://androidpublisher.googleapis.com/androidpublisher/v3/applications`. Most endpoints are scoped to a package name: `/applications/{packageName}/...`. Google uses `pageToken`/`nextPageToken` for pagination.

**Step 1: Create `src/client/api-client.ts`**

```typescript
import { getAccessToken } from "../auth/google-auth.js";

const BASE_URL = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

interface GoogleErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
    errors?: Array<{ message: string; domain: string; reason: string }>;
  };
}

export interface PaginatedResponse<T> {
  tokenPagination?: {
    nextPageToken?: string;
  };
  // Different endpoints use different wrapper keys — caller specifies via generic
  [key: string]: unknown;
}

export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail: string
  ) {
    super(`Google Play API Error [${status}] ${code}: ${detail}`);
    this.name = "APIError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorBody = (await response.json()) as GoogleErrorResponse;
      if (errorBody.error) {
        throw new APIError(
          errorBody.error.code,
          errorBody.error.status,
          errorBody.error.message
        );
      }
    } catch (e) {
      if (e instanceof APIError) throw e;
    }

    if (response.status === 401) {
      throw new APIError(401, "UNAUTHENTICATED", "OAuth2 token invalid or expired. Check your service account key.");
    }
    if (response.status === 403) {
      throw new APIError(403, "PERMISSION_DENIED", "Insufficient permissions. Ensure the service account has Play Console access.");
    }
    if (response.status === 429) {
      throw new APIError(429, "RATE_LIMITED", "Rate limited by Google. Try again in a moment.");
    }

    throw new APIError(response.status, "UNKNOWN", errorMessage);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function gpGet<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const token = await getAccessToken();
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return handleResponse<T>(response);
}

export async function gpPost<T>(
  path: string,
  body: unknown
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function gpPut<T>(
  path: string,
  body: unknown
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function gpDelete(path: string): Promise<void> {
  const token = await getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await handleResponse(response);
  }
}
```

**Step 2: Commit**

```bash
git add src/client/api-client.ts
git commit -m "feat: add API client with error handling and CRUD methods"
```

---

### Task 4: TypeScript types for Play API resources

**Files:**
- Create: `src/types/play-api.ts`

**Step 1: Create `src/types/play-api.ts`**

```typescript
// Google Play Developer API resource types
// Reference: https://developers.google.com/android-publisher/api-ref

// App Details (AppDetails resource)
export interface AppDetails {
  defaultLanguage: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
}

// Store Listing (Listing resource)
export interface Listing {
  language: string;
  title: string;
  fullDescription: string;
  shortDescription: string;
  video?: string;
}

// Track (Track resource — represents a release track)
export interface Track {
  track: string; // e.g. "production", "beta", "alpha", "internal"
  releases?: Release[];
}

export interface Release {
  name?: string;
  versionCodes?: string[];
  status: "completed" | "draft" | "halted" | "inProgress";
  userFraction?: number;
  releaseNotes?: LocalizedText[];
}

export interface LocalizedText {
  language: string;
  text: string;
}

// Review (Review resource)
export interface Review {
  reviewId: string;
  authorName: string;
  comments: Comment[];
}

export interface Comment {
  userComment?: UserComment;
  developerComment?: DeveloperComment;
}

export interface UserComment {
  text: string;
  lastModified: { seconds: string; nanos?: number };
  starRating: number;
  reviewerLanguage: string;
  device?: string;
  androidOsVersion?: number;
  appVersionCode?: number;
  appVersionName?: string;
  thumbsUpCount?: number;
  thumbsDownCount?: number;
}

export interface DeveloperComment {
  text: string;
  lastModified: { seconds: string; nanos?: number };
}

// In-App Product (InAppProduct resource)
export interface InAppProduct {
  packageName: string;
  sku: string;
  status: string;
  purchaseType: "managedUser" | "subscription";
  defaultPrice: {
    priceMicros: string;
    currency: string;
  };
  listings?: Record<string, { title: string; description: string }>;
  defaultLanguage?: string;
}

// Subscription (monetization/subscriptions)
export interface Subscription {
  productId: string;
  packageName: string;
  basePlans?: BasePlan[];
  listings?: SubscriptionListing[];
}

export interface BasePlan {
  basePlanId: string;
  state: "active" | "inactive" | "draft";
  autoRenewingBasePlanType?: {
    billingPeriodDuration: string;
  };
  prepaidBasePlanType?: {
    billingPeriodDuration: string;
  };
}

export interface SubscriptionListing {
  languageCode: string;
  title: string;
  description?: string;
  benefits?: string[];
}

// Testers (Testers resource)
export interface Testers {
  googleGroups?: string[];
}
```

**Step 2: Commit**

```bash
git add src/types/play-api.ts
git commit -m "feat: add TypeScript types for Google Play API resources"
```

---

### Task 5: Tool module — apps

**Files:**
- Create: `src/tools/apps.ts`

**Context:** Google Play doesn't have a "list all apps" endpoint. The `get` endpoint requires a package name. We'll accept a comma-separated list of package names for `list_apps`, and a single package name for `get_app_details`.

**Step 1: Create `src/tools/apps.ts`**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/tools/apps.ts
git commit -m "feat: add apps tool module"
```

---

### Task 6: Tool module — tracks (releases)

**Files:**
- Create: `src/tools/tracks.ts`

**Step 1: Create `src/tools/tracks.ts`**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/tools/tracks.ts
git commit -m "feat: add tracks tool module for release management"
```

---

### Task 7: Tool module — reviews

**Files:**
- Create: `src/tools/reviews.ts`

**Step 1: Create `src/tools/reviews.ts`**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/tools/reviews.ts
git commit -m "feat: add reviews tool module"
```

---

### Task 8: Tool module — listings

**Files:**
- Create: `src/tools/listings.ts`

**Step 1: Create `src/tools/listings.ts`**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gpGet, gpPut } from "../client/api-client.js";
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
      const response = await gpGet<ListingsListResponse>(
        `/${packageName}/edits/-/listings`
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
      const listing = await gpGet<Listing>(
        `/${packageName}/edits/-/listings/${language}`
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

      const listing = await gpPut<Listing>(
        `/${packageName}/edits/-/listings/${language}`,
        body
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
```

**Step 2: Commit**

```bash
git add src/tools/listings.ts
git commit -m "feat: add listings tool module for store listing management"
```

---

### Task 9: Tool module — in-app products

**Files:**
- Create: `src/tools/inapp-products.ts`

**Step 1: Create `src/tools/inapp-products.ts`**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/tools/inapp-products.ts
git commit -m "feat: add in-app products tool module"
```

---

### Task 10: Tool module — subscriptions

**Files:**
- Create: `src/tools/subscriptions.ts`

**Step 1: Create `src/tools/subscriptions.ts`**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/tools/subscriptions.ts
git commit -m "feat: add subscriptions tool module"
```

---

### Task 11: Tool module — testers

**Files:**
- Create: `src/tools/testers.ts`

**Step 1: Create `src/tools/testers.ts`**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/tools/testers.ts
git commit -m "feat: add testers tool module"
```

---

### Task 12: MCP server entry point

**Files:**
- Create: `src/index.ts`

**Step 1: Create `src/index.ts`**

```typescript
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
```

**Step 2: Build and verify**

```bash
npm run build
```

Expected: Clean compilation, no errors.

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add MCP server entry point wiring all tool modules"
```

---

### Task 13: README, CLAUDE.md, and CI

**Files:**
- Create: `README.md`
- Create: `CLAUDE.md`
- Create: `.github/workflows/release.yml`
- Create: `.github/config/release/release-please.config.json`
- Create: `.github/config/release/release-please-manifest.json`

**Step 1: Create `README.md`**

Follow the same structure as `asc-mcp-server` README but with:
- Google service account setup instructions (how to create a service account, grant Play Console access, download JSON key)
- Env var: `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`
- Setup sections for Claude, Cursor, Antigravity using `npx -y playstore-mcp`
- Tool table with all 14 tools

**Step 2: Create `CLAUDE.md`**

Same format as asc-mcp-server CLAUDE.md, adapted for this project.

**Step 3: Create release workflow**

Copy from asc-mcp-server: `.github/workflows/release.yml`, `.github/config/release/release-please.config.json`, `.github/config/release/release-please-manifest.json` — update package name references.

**Step 4: Commit**

```bash
git add README.md CLAUDE.md .github/
git commit -m "docs: add README, CLAUDE.md, and CI workflow"
```

---

### Task 14: Push to GitHub and publish

**Step 1: Create GitHub repo**

```bash
gh repo create mohn93/playstore-mcp --public --source=. --push
```

**Step 2: Set npm token secret**

```bash
gh secret set NPM_TOKEN --repo mohn93/playstore-mcp
```

**Step 3: Enable Actions PR permissions**

```bash
gh api --method PUT repos/mohn93/playstore-mcp/actions/permissions/workflow \
  -f default_workflow_permissions="write" \
  -F can_approve_pull_request_reviews=true
```
