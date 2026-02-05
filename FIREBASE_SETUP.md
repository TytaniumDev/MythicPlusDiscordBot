# Firebase Setup Instructions

This project uses Firebase Firestore to synchronize the Discord Bot (Backend) and the Activity Website (Frontend).

## 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click "Add project" and follow the prompts.
3. Once created, go to **Project Settings** (gear icon).

## 2. Frontend Configuration (GitHub Secrets)
The frontend (Activity) needs public configuration to connect to Firebase.

1. In Firebase Console > Project Settings > General, scroll down to "Your apps".
2. Click the Web icon (</>) to create a new web app.
3. Copy the configuration values (apiKey, authDomain, etc.).
4. Go to your GitHub Repository -> Settings -> Secrets and variables -> Actions.
5. Add the following Repository Secrets:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

## 3. Backend Configuration (Service Account)
The bot needs a Service Account to write to Firestore with admin privileges.

1. In Firebase Console > Project Settings > **Service accounts**.
2. Click "Generate new private key".
3. This will download a `.json` file containing your credentials.
4. **Minify** this JSON (remove newlines) so it fits on one line. You can use an online tool or `jq -c . file.json`.
5. Add this string as a GitHub Secret named `FIREBASE_CREDENTIALS_JSON` (if you run the bot via Actions) OR add it to your `.env` file for local development:
   ```env
   FIREBASE_CREDENTIALS_JSON='{"type": "service_account", ...}'
   ```

## 4. Production Deploy (GitHub Actions)
For the main bot deploy (e.g. to a Raspberry Pi via `.github/workflows/deploy.yml`), set the repository secret `FIREBASE_CREDENTIALS_JSON` in GitHub (Settings → Secrets and variables → Actions). The deploy workflow passes it into the Pi environment so the container can use Firebase. Without this secret, the bot will run but Firebase features (e.g. `/activity` live lobby) will be disabled.

## 5. Firestore Database and Rules
1. Go to **Firestore Database** in the left sidebar.
2. Click "Create Database".
3. Choose **Standard** edition and select a location (e.g. your nearest region).
4. After the database is created, open the **Rules** tab.
5. Replace the default rules with the following so the Activity and bot can read/write sessions (we rely on opaque session IDs; you can add Auth or stricter rules later):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /sessions/{sessionId} {
         allow read, write: if true;
       }
     }
   }
   ```
   *Warning: This allows anyone to read/write sessions. For a production app, you should restrict writes to only the fields the frontend needs to update (like status).*
