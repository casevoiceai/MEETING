# CASEVOICE Founder CRM

## Local Development

### Ports

| Service | URL |
|---|---|
| Frontend CRM | http://127.0.0.1:5173 |
| Backend API | http://127.0.0.1:5174 |
| Local AI service | http://127.0.0.1:5000 |

### Starting the frontend

Use the canonical startup command:

```
npm run start:local
```

Do **not** run `npm run dev` for local development — it does not enforce the required host and port.

### Starting the backend (port 5174)

The local backend is a Node.js server. Start it separately:

```
node server.cjs
```

`server.cjs` is a local-only file and is not committed to the repo. Keep it in the project root on your machine.

### Local AI service (port 5000)

The local AI service runs independently at http://127.0.0.1:5000. Start it according to its own setup instructions before using AI features.

### Production deploy

Production uses Cloudflare Workers via `wrangler`. See `wrangler.jsonc` for config. Do not use Vercel.

`GOOGLE_CLIENT_SECRET` must be stored as a Cloudflare Worker secret. Never commit the secret value to `wrangler.jsonc`, `.env`, documentation, issues, pull requests, or other tracked files.

`OPENAI_API_KEY` must also be stored as a Cloudflare Worker secret. Foundry calls OpenAI only through Worker routes such as `/api/foundry-analyze` and `/api/foundry-transcribe`; never expose the key in browser code or tracked files.

Foundry does not use a separate browser password or access key. Protect the `foundercrm` Worker with Cloudflare Access so approved users sign in once at the Worker edge. The Foundry API routes require an authenticated Cloudflare Access session before OpenAI is called.

Before deploying a new or rotated Google OAuth credential, set the production Worker secret using the Cloudflare dashboard or Wrangler secret management, then verify the OAuth connection before removing the prior credential.

```
npm run build
npx wrangler deploy
```
