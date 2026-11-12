# GoDaddy independent Preview runtime

## Evidence and scope
Reported logs mention Turbopack permission denied and failed endpoint writes. These are consistent with development compilation on a restricted filesystem. They do not prove which command GoDaddy actually runs. No GoDaddy dashboard, startup settings or full sanitized runtime logs were available for this fix. Actual platform configuration remains unverified.

This branch contains V2 and is NOT main. Do not enable branch deployment or merge until the database backup/restore and migration gates are satisfied. No bibichik.com project/domain changes are required or authorised.

## Repository production contract
- Build: `npm ci --include=dev` followed by `npm run build`.
- Build uses `next build --webpack`; no Turbopack compiler is used.
- Start: `npm start` (equivalently `node scripts/start-production.mjs`).
- Start requires an existing `.next/BUILD_ID`, forces NODE_ENV=production, honours the host's PORT and binds 0.0.0.0. It never builds at runtime or falls back to next dev.
- Local development remains `npm run dev`; it refuses NODE_ENV=production.
- Use a Node-capable persistent hosting service meeting package.json engines; static-only hosting cannot run this app.
- Keep node_modules, `.next` build output and public assets in the SAME deployed application release. Do not commit them to Git. If the host separates build/runtime stages it must carry these artifacts and production dependencies forward. Keep build dependencies during build; TypeScript/Tailwind are needed then.
- Do not solve development-compiler errors by chmod 777, running as root, or making the full application directory world-writable. Production Next.js may still require designated cache/temp write access depending on hosting/features.

## Manual GoDaddy verification — labels depend on the actual hosting product
1. Open ONLY the independent booking Preview application's settings. Verify repository and branch. Leave the existing website and main deployment untouched.
2. Inspect the actual build and runtime commands. If the product exposes them, set build steps as above and runtime to `npm start`. Remove `next dev`, `npm run dev`, or framework development-preview mode from the runtime configuration. Set NODE_ENV=production in the runtime settings.
3. Preserve the assigned PORT; do not hardcode port 3000 or 80 on the platform. Do not use `npx next dev` as an entrypoint. If the product only offers development preview and cannot configure a production start command, stop: repository changes cannot force a hardcoded platform command to change. Ask GoDaddy to confirm support for a persistent Next.js production server and provide the effective startup command.
4. Verify the application working directory contains package.json and the generated .next/BUILD_ID. A failed build must prevent startup; do not run npm start without build artifacts.
5. Verify environment-variable presence privately: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SITE_URL; optional MAINTENANCE_SECRET for the protected expiry scheduler. Never put secret values in NEXT_PUBLIC variables, commands, screenshots or logs. SITE_URL must equal the independent Preview HTTPS origin.
6. Set liveness to GET /api/health (200). /api/ready is database readiness: 503 is EXPECTED until the V2 migration and configuration are present. Do not mistake this migration-gate 503 for a Turbopack runtime crash. Do not weaken the readiness check or migrate merely to make it green.
7. After separately approved backup/restore and migration, verify /api/ready, secure login cookies, origins, branded static assets, and synthetic test workflows. Keep both V2 booking switches false and all four original slots disabled until acceptance.

## What remains external
Actual GoDaddy effective command, filesystem policy, artifact persistence, restart/health settings and server logs must be inspected on the platform. This document supplies precise commands, not an assertion that those settings were changed. No deployment has been performed.
