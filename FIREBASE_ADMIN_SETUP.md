# Firebase Admin SDK Setup Guide

## Overview
Firebase Admin SDK allows server-side API routes to bypass Firestore security rules, which is necessary for:
- Fetching user bets
- Caching games
- Refreshing betting lines
- All server-side Firebase operations

## Step 1: Get Service Account Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (the one matching `NEXT_PUBLIC_FIREBASE_PROJECT_ID`)
3. Click the gear icon ⚙️ → **Project Settings**
4. Go to the **Service Accounts** tab
5. Click **Generate New Private Key**
6. Click **Generate Key** in the confirmation dialog
7. A JSON file will download (e.g., `groupbet-firebase-adminsdk-xxxxx.json`)

## Step 2: Extract Credentials from JSON

Open the downloaded JSON file. You'll need these three values:

```json
{
  "project_id": "your-project-id",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
}
```

## Step 3: Set Environment Variables in Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the **groupbet** project
3. Go to **Settings** → **Environment Variables**
4. Add these three variables:

### Variable 1: `FIREBASE_PROJECT_ID`
- **Value**: The `project_id` from the JSON file
- **Environment**: Production, Preview, Development (all)

### Variable 2: `FIREBASE_CLIENT_EMAIL`
- **Value**: The `client_email` from the JSON file
- **Environment**: Production, Preview, Development (all)

### Variable 3: `FIREBASE_PRIVATE_KEY`
- **Value**: The entire `private_key` string from the JSON file (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
- **Important**: Copy the ENTIRE key including the header and footer
- **Environment**: Production, Preview, Development (all)

## Step 4: Redeploy

After adding the environment variables:
1. Go to **Deployments** tab in Vercel
2. Click the **⋯** menu on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger a new deployment

## Step 5: Verify Setup

Once deployed, check the server logs. You should see:
```
✅ Firebase Admin SDK initialized with service account
```

If you see:
```
⚠️ Falling back to client SDK - this may cause permission errors
```

Then the environment variables are not set correctly. Double-check:
- All three variables are set
- `FIREBASE_PRIVATE_KEY` includes the full key with headers
- Variables are available in the correct environment (Production)

## Troubleshooting

### "Missing or insufficient permissions" still occurs
- Verify all three environment variables are set in Vercel
- Check that `FIREBASE_PRIVATE_KEY` is the complete key (not truncated)
- Ensure variables are set for Production environment
- Redeploy after adding variables

### "Failed to initialize Firebase Admin SDK"
- Check that `FIREBASE_PRIVATE_KEY` has proper newlines (the code handles `\n` conversion)
- Verify the private key wasn't corrupted when copying
- Ensure `FIREBASE_PROJECT_ID` matches your actual Firebase project ID

### Local Development
For local development, you can either:
1. Add the same environment variables to `.env.local` (not committed to git)
2. Or use Firebase Application Default Credentials (if you have `gcloud` CLI configured)

## Security Notes

⚠️ **IMPORTANT**: 
- Never commit the service account JSON file to git
- Never commit `FIREBASE_PRIVATE_KEY` to git
- The `.env.local` file should be in `.gitignore` (it already is)
- Service account has admin access - keep credentials secure
