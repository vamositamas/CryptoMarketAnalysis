# Vercel Deployment

## Target

Deploy the Angular frontend and Node.js API on Vercel with Node.js 20 runtime.

## Project Setup

- Import the GitHub repository into Vercel.
- Framework preset: Angular
- Build command: `npx nx build web --configuration=production`
- Output directory: `dist/apps/web/browser`
- Install command: `npm install`
- Node.js runtime: 20.x

## API Runtime

The root `vercel.json` declares `apps/api/src/main.ts` as a Node.js 20 serverless function with a 10 second max duration.

Later API stories may adapt the Express bootstrap for Vercel's request handler shape if needed.

## Environment Variables

Configure deployment secrets in the Vercel dashboard:

- `SUPABASE_DATABASE_URL`
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`
- `QSTASH_URL`
- `QSTASH_TOKEN`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## Verification Checklist

- Vercel project is linked to the GitHub repository.
- Production deployment uses Node.js 20.x.
- Frontend build succeeds.
- Static frontend is available at the assigned Vercel URL.
- API route smoke test succeeds after API handler adaptation.
- Security headers are present in deployed responses.
