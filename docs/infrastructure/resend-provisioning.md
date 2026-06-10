# Resend Email Provisioning

## Target

Configure Resend for transactional emails used by verification, alerts, password reset, donation receipts, and administrative test sends.

## Required Settings

- Sender domain: `cryptomarketanalysis.com` or the launch domain
- DNS records: SPF and DKIM records verified in Resend
- API key: generated for backend use

## Environment Variables

Copy `apps/api/.env.example` to `apps/api/.env` locally and fill:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Do not commit real `.env` files.

## Template Directories

Email templates are organized by language:

- `apps/api/src/templates/emails/en`
- `apps/api/src/templates/emails/hu`

Specific templates are added by the feature stories that send those emails.

## Verification Checklist

- Sender domain is verified in Resend.
- API key is available locally and in deployment secrets.
- Test email sends successfully from the configured sender.
- SPF/DKIM DNS records remain valid after propagation.
