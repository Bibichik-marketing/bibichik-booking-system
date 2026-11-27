# Staff native dates and responsive reservation cards

## Root causes and implementation

CSS-only sizing still relied on WebKit's internal date editor to show text. That renderer can be blank or paint outside the control on iOS even when the outer input has a constrained width. StaffDateInput now provides visible date/time text (or translated prompt) and a calendar control independently of native value painting. The real native input remains the full-field hit target and retains its name, required/min/step attributes and ISO value. The handler focuses it before requesting showPicker in a trusted gesture; unsupported APIs retain native tap/focus behaviour. Focus-before-picker was needed for reliable native date commitment in local testing.

The component covers the list date filter, timeline date, reservation edits, manual Staff bookings, schedule times and quota/closure datetime ranges. Controlled filters forward the original event to the existing setter; uncontrolled operation forms retain their edited ISO values for FormData. Date formatting only rearranges numeric components for display; Malaysia timezone handling and API conversions are unchanged. All blank prompts have English/Chinese/Malay translations. Customer date controls are unchanged; only the existing staffSource branch of the shared reservation form uses this Staff component.

The former list squeezed six desktop columns into phone widths. At <=1024px, the same table rows now form cards: full-width name/reference, readable date/time, outlet, guest count, status and the existing detail action. Translated data-label values provide the visual labels. No duplicate record list or new mobile action handlers exist. At >1024px, desktop table styles remain unchanged. Existing palette, fonts, status badges and action buttons are retained. Roles/API/database authorization remain untouched.

## Validation

- TypeScript, ESLint, all 167 tests and production build passed.
- Added native field regression tests for three empty prompts, date/time/datetime values and original names/validation, picker fallback, exact controlled changes and persistence/clearing of uncontrolled operation values.
- Used an isolated hydrated Next.js Staff demo copy without environment files, credentials or Supabase access. No reservation/settings forms were submitted.
- 120 layout cases passed: Overview, Today, Pending, Availability Timeline and Outlet Settings, in English/Chinese/Malay, at 320, 375, 390, 430, 768, 820, 1024 and 1440px. No page overflow; date wrappers and native hit targets fit, displayed text and had >=44px targets. Cards contained all six original cells/labels at phone/tablet sizes; 1440px retained table-row layout.
- Opened native calendar by clicking the whole field at 375px. With focus-before-picker, native keyboard date selection displayed 28/11/2026, forwarded 2026-11-28 and filtered fictional rows from six to zero. Reset cleared the filter and restored six rows. Existing card detail action opened Reservation Details and retained the edit date control.
- Manual booking date controls passed all eight widths. No Production records were used or changed. Existing security, rejection-reason, reconfirmation, WhatsApp, notification and larger-party regression tests remain green.

## Device limitations / acceptance

The browser tools provided viewport resizing and pointer/native keyboard interaction, not full physical touchscreen emulation. No physical iPhone/iPad/Android was controlled. Before publication, check actual tap/selection and accessibility on iPhone Safari (320–430px), iPad Safari (768/820/1024px, portrait/landscape) and Android. Verify both empty and selected prompts, keyboard focus, native calendar selection, date ranges, card details and reset. Native calendar popups are browser/OS UI outside webpage clipping and screenshot capture.

No Supabase, migrations, capacities, booking rules, permissions, reservations, feature flags, Aburii or GoDaddy settings changed. The isolated test server was stopped after checks.
