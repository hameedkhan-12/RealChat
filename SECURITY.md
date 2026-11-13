# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

Please report security vulnerabilities to security@yourdomain.com.

## Security Features

- **Tenant Isolation**: All data access is scoped by `domainId`
- **Authentication**: Clerk handles user authentication
- **Authorization**: `requireDomainAccess()` enforces role-based access control
- **Rate Limiting**: Upstash Redis rate limits on all API endpoints
- **Bot Protection**: Cloudflare Turnstile on session creation
- **Secure Embedding**: Origin validation for widget embedding
- **Content Security Policy**: Strict CSP headers
- **Session Tokens**: SHA-256 hashed session tokens with expiry
- **PII Handling**: All personal data redacted in logs

## Environment Variables

Never commit `.env` files. Required production secrets:

- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `PUSHER_SECRET`
- `UPSTASH_REDIS_REST_TOKEN`
- `TURNSTILE_SECRET_KEY`
- `SMTP_PASS`

## Local Development

1. Never commit `.env` files
2. Rotate Pusher secrets if they were ever committed
3. Use `.env.example` as a template
