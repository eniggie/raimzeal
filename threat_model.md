# Threat Model

## Project Overview

RAIMZEAL is a public fitness and wellness application with a static web frontend, an Expo-based mobile app, and a small Express API. The web app is largely a client-side SPA, the mobile app uses Supabase for authentication and user data sync, and the API server handles AI chat, email delivery, weekly digest orchestration, and database-backed subscriber storage. Production deployment is public, while the mockup sandbox is a development-only surface and should normally be ignored during production scans.

## Assets

- **User health and profile data** -- names, email addresses, age, weight, height, goals, workout history, nutrition logs, body measurements, hydration history, and community content. This is sensitive personal data and some of it is health-adjacent.
- **User sessions and identity state** -- Supabase sessions in the mobile app and any future server-side account state. Compromise would allow impersonation or unauthorized data access.
- **Email infrastructure** -- SMTP credentials, digest subscriber list, and the ability to send messages as RAIMZEAL. Abuse would enable spam, phishing, or account-targeted social engineering from a trusted sender.
- **AI/API spend and third-party credentials** -- OpenAI integration credentials and Brave Search API key. Abuse would create direct cost and availability impact.
- **Application database** -- Postgres-backed digest subscriber records and any shared schema used by production services.

## Trust Boundaries

- **Public client to API server** -- browsers and mobile clients call `/api/*`. The client is untrusted and all sensitive actions must be authenticated, authorized, and rate-limited server-side.
- **Mobile app to Supabase** -- the mobile app directly accesses Supabase with a public anon key and user session. Access control for that boundary depends on Supabase-side policy enforcement.
- **API server to Postgres** -- the Express API has direct database access via Drizzle. Any injection or missing authorization in the API can translate into persistent data compromise.
- **API server to SMTP provider** -- the email routes can spend sender reputation and relay messages externally. Unauthorized access here becomes spam/phishing capability.
- **API server to OpenAI and Brave Search** -- the AI route can transmit user context and consume paid third-party resources. Unrestricted public access creates spend and abuse risk.
- **Production vs dev-only surfaces** -- `artifacts/mockup-sandbox/` and `.migration-backup/` are not production surfaces unless separately proven reachable.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/raimzeal/server.mjs`, `artifacts/raimzeal-mobile/server/serve.js`
- **Highest-risk code areas**: `artifacts/api-server/src/routes/email.ts`, `artifacts/api-server/src/routes/ovia.ts`, `artifacts/raimzeal-mobile/lib/db.ts`, `artifacts/raimzeal-mobile/app/(tabs)/community.tsx`, `artifacts/raimzeal-mobile/contexts/AuthContext.tsx`
- **Public surfaces**: `/api/healthz`, `/api/ovia/chat`, `/api/email/*`, public web SPA, mobile manifest/static server
- **Authenticated surfaces**: mobile Supabase-backed profile and sync features
- **Dev-only areas usually ignored**: `artifacts/mockup-sandbox/`, `.migration-backup/`

## Threat Categories

### Spoofing

Identity-sensitive actions must be bound to a real authenticated user. Public endpoints that trigger account-related messaging, profile-affecting side effects, or privileged maintenance behavior must not trust caller-supplied email addresses, names, or profile context as proof of identity.

### Tampering

Clients supply profile data, chat history, and digest subscription data across multiple surfaces. The system must treat all client input as untrusted, validate it server-side, and ensure privileged operations cannot be steered solely by caller-controlled JSON fields.

### Information Disclosure

The system processes personal fitness and health-adjacent data, email addresses, and account metadata. API responses, logs, email flows, and third-party integrations must avoid leaking secrets or sensitive user data, and debug-only behavior must not be reachable in production.

### Denial of Service

Public routes can trigger expensive SMTP sends, database work, and streamed AI completions. These endpoints must be protected with authentication where appropriate and rate limiting or quota controls where public access is intended; otherwise an attacker can create direct cost, queue saturation, or provider throttling.

### Elevation of Privilege

Admin-like capabilities such as mass digest sending, subscriber management, or any future user data access must be enforced server-side. The API must not expose privileged functions to anonymous callers, and direct mobile-to-Supabase access must rely on backend-enforced policies rather than client behavior. Any community feature that lets one user affect another user's post state must be implemented through narrowly scoped backend logic rather than broad row updates from an untrusted client.
