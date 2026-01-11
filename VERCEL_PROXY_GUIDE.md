# How to Fix Mixed Content (HTTP/HTTPS) with Vercel Proxy

This guide explains how to securely connect your Vercel frontend (HTTPS) to an insecure backend (HTTP) without getting "Mixed Content" errors.

## Step 1: Configure Vercel Proxy

Create a file named `vercel.json` in the root of your project.

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "http://YOUR_BACKEND_IP:PORT/api/:path*"
    }
  ]
}
```

- Replace `YOUR_BACKEND_IP:PORT` with your actual Azure VM address (e.g., `102.37.19.54:8000`).
- This rule tells Vercel: "When someone asks for `/api/...`, secretly fetch it from my VM and send it back."

## Step 2: Update Your Frontend Code

You must change how your code makes API requests. You have two options:

### Option A: The Simple Way (Always Proxy)

Change all your API URLs to be relative paths.
**Before:**

```javascript
fetch("http://102.37.19.54:8000/api/generate", ...)
```

**After:**

```javascript
fetch("/api/generate", ...)
```

### Option B: The Smart Way (Dynamic)

Use this helper function to automatically switch between Proxy (Production) and Direct (Development) or Secure Custom URLs.

```typescript
const getApiBaseUrl = () => {
  // 1. Get URL from env var (e.g., set locally in .env)
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL;

  // 2. If no URL is set, default to "" (relative path) to use Vercel Proxy
  if (!configuredUrl) return "";

  // 3. Safety Check: If we are on HTTPS but the config is HTTP, force Proxy
  if (typeof window !== "undefined" && window.location.protocol === "https:" && configuredUrl.startsWith("http:")) {
      console.warn("Mixed Content Prevention: Switching to Vercel Proxy for insecure API URL.");
      return "";
  }

  return configuredUrl;
};

// Usage
const BASE_URL = getApiBaseUrl();
fetch(`${BASE_URL}/api/generate`, ...);
```

## Step 3: Deploy

1.  Push your changes (including `vercel.json`) to GitHub.
2.  Vercel will automatically redeploy.
3.  Test your app—the Mixed Content error should be gone!
