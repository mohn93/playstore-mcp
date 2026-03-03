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
