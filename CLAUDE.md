# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) server that exposes Google's Android Publisher API v3 as tools. Built with TypeScript, runs over stdio transport.

## Commands

- **Build:** `npm run build` (compiles TypeScript to `build/`)
- **Dev:** `npm run dev` (watch mode)
- **Run:** `npm start` (runs `build/index.js`)

No test framework is configured yet.

## Required Environment Variables

- `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` — Path to Google service account JSON key file

## Architecture

### Entry Point & Wiring

`src/index.ts` creates an `McpServer` (from `@modelcontextprotocol/sdk`), registers all tool modules, and connects via `StdioServerTransport`. Each tool domain is a separate module that exports a `registerXxxTools(server: McpServer)` function.

### Layers

```
src/index.ts              — Server bootstrap, tool registration
src/auth/google-auth.ts   — Google OAuth2 service account auth with auto-refresh
src/client/api-client.ts  — HTTP client (GET/POST/PUT/DELETE) for androidpublisher v3
src/types/play-api.ts     — TypeScript interfaces for all Play API resources
src/tools/*.ts            — Tool modules (one per API domain)
```

### API Client (`src/client/api-client.ts`)

Provides `gpGet`, `gpPost`, `gpPut`, `gpDelete`. All requests go through `https://androidpublisher.googleapis.com/androidpublisher/v3/applications` with automatic OAuth2 auth. Custom `APIError` class carries status, code, and detail. Google pagination uses `pageToken`/`nextPageToken`.

### Tool Module Pattern

Every file in `src/tools/` follows the same structure:

1. Export `registerXxxTools(server: McpServer)`
2. Define Zod schemas for input validation
3. Call `server.tool(name, description, zodSchema, handler)` for each tool
4. Handler calls the API client, formats the response, returns `{ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }`

Tool names use `snake_case`. Errors return `{ content: [...], isError: true }`.

### Adding a New Tool Module

1. Create `src/tools/<domain>.ts` with a `register<Domain>Tools(server: McpServer)` function
2. Import and call it in `src/index.ts`

## Tool Modules

apps, tracks, reviews, listings, inapp-products, subscriptions, testers
