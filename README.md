# Play Store MCP Server

An MCP (Model Context Protocol) server that wraps Google's [Android Publisher API](https://developers.google.com/android-publisher), giving AI assistants the ability to manage Play Store apps, releases, reviews, listings, and more — right from your IDE.

## Getting Your API Credentials

You need a **Google Cloud service account** with Play Console access. Here's how to set it up:

1. Go to [Google Cloud Console → IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Select your project (or create one)
3. Click **Create Service Account**
4. Give it a name (e.g. "MCP Server") and click **Create and Continue**
5. Skip the optional roles step — click **Done**
6. Click on the newly created service account, go to the **Keys** tab
7. Click **Add Key → Create new key → JSON** and download the file
8. Save the JSON key file somewhere secure (e.g. `~/.google/play-service-account.json`)

### Enable the Google Play Developer API

9. Go to [Google Cloud Console → Google Play Android Developer API](https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com)
10. Make sure your project is selected, then click **Enable**

### Grant Play Console Access

11. Go to [Google Play Console](https://play.google.com/console) → **Users and permissions**
12. Click **Invite new users**
13. Enter the service account's `client_email` (found in the JSON key file, e.g. `my-service-account@my-project.iam.gserviceaccount.com`)
14. Under **App permissions**, add the apps you want the service account to access
15. Grant the necessary permissions (e.g. **View app information and download bulk reports**, **Manage production releases**, **Reply to reviews**)
16. Click **Invite user**

> **Important:** You need **account owner** or **admin** permissions in the Play Console to invite new users. If you don't have either role, ask someone who does to complete this step.

| Credential | Where to find it |
|---|---|
| **Service Account JSON Key** | Downloaded in step 7 — contains `client_email`, `private_key`, and `project_id` |

> **Note:** The JSON key file can only be downloaded once when created. If lost, generate a new key from the Keys tab.

## Setup

### Claude

<details>
<summary>Claude Code (CLI)</summary>

```bash
claude mcp add playstore \
  --transport stdio \
  --env GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/absolute/path/to/service-account.json \
  -- npx -y playstore-mcp
```

</details>

<details>
<summary>Claude Desktop</summary>

Add to your `claude_desktop_config.json`:

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "playstore": {
      "command": "npx",
      "args": ["-y", "playstore-mcp"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY_PATH": "/absolute/path/to/service-account.json"
      }
    }
  }
}
```

</details>

### Cursor

Add to `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` for global):

```json
{
  "mcpServers": {
    "playstore": {
      "command": "npx",
      "args": ["-y", "playstore-mcp"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY_PATH": "/absolute/path/to/service-account.json"
      }
    }
  }
}
```

Verify under **Cursor Settings → MCP** after restarting.

### Antigravity

Add to `~/.gemini/antigravity/mcp_config.json` (or via **Agent pane → MCP Servers → Manage MCP Servers → View raw config**):

```json
{
  "mcpServers": {
    "playstore": {
      "command": "npx",
      "args": ["-y", "playstore-mcp"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY_PATH": "/absolute/path/to/service-account.json"
      }
    }
  }
}
```

> **Tip:** Run `npx -y playstore-mcp` once in your terminal first so the package is cached — Antigravity's first-run timeout can otherwise cause the server to fail to start.

## Available Tools

| Tool | Description |
|------|-------------|
| `get_app_details` | Get app details by package name |
| `list_tracks` | List release tracks (production, beta, alpha, internal) |
| `get_track` | Get details of a specific release track |
| `list_reviews` | List user reviews for an app |
| `reply_to_review` | Reply to a user review |
| `list_listings` | List all store listings (all locales) |
| `get_listing` | Get store listing for a specific locale |
| `update_listing` | Update store listing for a locale |
| `list_inapp_products` | List managed in-app products |
| `get_inapp_product` | Get details of a specific in-app product |
| `list_subscriptions` | List subscriptions for an app |
| `get_subscription` | Get details of a specific subscription |
| `list_testers` | List testers for a specific track |
| `update_testers` | Update testers (Google Groups) for a track |

## License

MIT
