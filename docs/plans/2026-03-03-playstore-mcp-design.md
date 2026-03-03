# Play Store MCP Server — Design

## Overview

MCP server wrapping Google's Android Publisher API v3, giving AI assistants the ability to manage Play Store apps, releases, reviews, listings, in-app products, subscriptions, and testers via stdio transport. Mirrors the architecture of the existing `asc-mcp-server`.

## Auth

- **Credential:** Google service account JSON key file
- **Env var:** `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`
- **Scope:** `https://www.googleapis.com/auth/androidpublisher`
- **Library:** `google-auth-library` (official Google OAuth2 client)
- **Caching:** Token cached with auto-refresh before expiry

## API Client

- **Base URL:** `https://androidpublisher.googleapis.com/androidpublisher/v3/applications`
- **Functions:** `gpGet`, `gpPost`, `gpPut`, `gpDelete`, `gpGetAll` (pagination via `pageToken`/`nextPageToken`)
- **Error handling:** Custom `APIError` class with status, code, detail

## Tool Modules

| Module | Tools |
|---|---|
| `apps.ts` | `list_apps`, `get_app_details` |
| `tracks.ts` | `list_tracks`, `get_track` |
| `reviews.ts` | `list_reviews`, `reply_to_review` |
| `listings.ts` | `get_listing`, `update_listing` |
| `inapp-products.ts` | `list_inapp_products`, `get_inapp_product` |
| `subscriptions.ts` | `list_subscriptions`, `get_subscription` |
| `testers.ts` | `list_testers`, `update_testers` |

## Dependencies

- `@modelcontextprotocol/sdk` — MCP protocol
- `google-auth-library` — OAuth2 service account auth
- `zod` — input validation
- `typescript` (dev)

## Package

- **Name:** `playstore-mcp` (or scoped if taken)
- **Bin:** `playstore-mcp`
- **Same CI:** release-please + npm publish workflow
