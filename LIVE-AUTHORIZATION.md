# Read-only live authorization test

Run in a private local terminal, with the app running at SITE_URL:

```sh
cd ~/Documents/GitHub/bibichik-booking-system
node scripts/test-live-authorization.mjs --read-only
```

The default is also read-only. Never add --allow-write-tests during this investigation. Conflicting read-only/write flags are rejected.

Enter RUN, then Admin email/password, SS2 Staff email/password, and Sunway Staff email/password at hidden prompts. No date is requested in read-only mode. Do not paste credentials into chat, arguments, recorded terminal sessions or shell tracing. Environment keys are loaded locally; read-only mode requires SUPABASE_URL, SUPABASE_ANON_KEY and local HTTP SITE_URL, and does not require the service-role key.

Independent checks: Supabase Auth validates both direct-RPC and API-cookie user identities, the identities must match per account and differ across accounts, staff_reservations accepts each authenticated caller, API and RPC booking ID/outlet visibility match, staff lists contain no opposite-outlet rows, known opposite-outlet records from the Admin baseline are absent, and own-outlet baseline rows are present. Admin visibility is verified with existing rows from both outlets. Unauthenticated API and anonymous RPC calls must be denied. Personal data and identifiers are compared only in memory, not logged.

The Admin/SS2/Sunway account labels and their actual role/outlet mappings are manually verified operator inputs. The runner does NOT independently read staff_members or assert that it queried exact roles. It independently verifies identity and observable authorization behavior. Direct staff_members SELECT remains restricted and is not used. No grants or database changes are required.

Absent baseline rows yield INCONCLUSIVE, including the final summary. Unexpected cross-outlet records yield FAIL. API/RPC lists are sequential snapshots: concurrent reservation changes can cause a visibility mismatch; keep bookings stable during this diagnostic and investigate before classifying a mismatch as a vulnerability.

Read-only mode does not create, change or delete reservations, invoke status mutations, run manual booking tests, or execute fixture cleanup. Login/logout affect only temporary Auth sessions. Tokens stay in memory. Existing write-mode code remains explicitly opt-in for a future separately authorized investigation; do not use it now.

Share only sanitized PASS/FAIL/INCONCLUSIVE or stage/category lines. A successful read test does not prove write authorization or resolve historical mutation failures. No live authenticated checks were executed automatically as part of this runner update.

## Controlled write authorization test — prepared, not executed
Only after an explicit operator decision, run:

```sh
node scripts/test-live-authorization.mjs --allow-write-tests
```

Keep the local app running, use the three manually verified test accounts, and use an available future test date. Enter RUN and credentials at hidden prompts. The runner selects the first available one-person slot on that date per outlet (not a fixed time). Do not run it on a project with automatic booking notifications unless synthetic bookings are excluded from those notifications. The runner itself sends no messages.

Exactly one marked Pending fixture is created per outlet, after checking its random UUID does not already exist. Fixture identity is verified before every write using UUID, exact run marker, exact synthetic name and outlet. Opposite-outlet staff attempts Pending→Confirmed through RPC and API. All denials must pass before positive controls begin; successful responses or any observed record changes stop testing and enter guarded cleanup. Unexpected denial categories also fail closed. Admin then approves both via RPC; assigned staff seat via API and complete via RPC, with direct database reads verifying persistence after every operation. This tests status writes, not every manual-booking authorization case.

Cleanup verifies identity, deletes using UUID/name/marker/outlet filters, and confirms no row remains. It needs existing service-role SELECT/DELETE permissions; no grants are performed. Failed or ambiguous requests are not retried automatically. Capacity is consumed until cleanup and no other staff should edit synthetic rows during the test. Ctrl-C, process kill, network loss or permission changes can prevent cleanup. Save the printed non-secret recovery marker. If interrupted, privately verify UUID/name/outlet/exact marker before manually removing only that run's synthetic rows; do not delete by name alone.

A passing read-only run proves observed read isolation, not mutation safety. Write outcomes remain unknown until this controlled run. Do not deploy based on local unit-test success alone.
