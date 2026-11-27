# Customer native date control — iOS rendering hardening

## Root cause and approach

The earlier fixes constrained the outer input and some WebKit pseudo-elements, but still depended on WebKit's internal date editor for both visible content and intrinsic sizing. CSS width/min-width rules on the host input do not reliably control that native renderer on every iPhone/iPad Safari version, and an empty native date input may show no placeholder. Desktop viewport tests alone did not certify physical iOS behaviour. The currently hosted build/version and the reported screenshot's computed styles were not inspected in this change.

CustomerReservationDate now separates visible presentation from native input painting. An ordinary constrained field displays the localized date or empty-date hint and a calendar icon. The real required input type=date covers the entire field as the touch/focus target, with zero minimum size, border-box sizing, no extra padding/margin and clipped intrinsic painting. Its native rendered text is transparent; the visible date is rendered from the same controlled ISO value. This is not a custom calendar or a text field pretending to be a date input. A trusted click requests showPicker when supported; exceptions leave the browser's normal native tap/focus handling intact. Keyboard focus has the same existing focus outline.

The field uses the exact same grid track width as Guest Count. Native min-date validation remains based on malaysiaToday(). Selection passes the exact YYYY-MM-DD value back to the existing callback, which clears old slots/selection and requests new availability. Only display formatting uses Intl with Asia/Kuala_Lumpur; no booking date/payload conversion is introduced. Empty values remain empty, never fabricated as today. Staff/manual forms continue rendering their original native input without this wrapper.

## Verification

- TypeScript, ESLint, 163 tests and production build passed.
- New tests cover all five language displays, empty/selected states, native type/min/required/value attributes, whole-field showPicker success/unavailable/error handling and unchanged ISO selection/clearing.
- Isolated hydrated Next.js copy used no environment files, credentials or Supabase configuration. Only that temporary copy had synthetic availability fixtures and expanded guest options. Repository API routes/flags and Production settings were not changed.
- 90 responsive cases passed: empty and selected states in English, Chinese, Malay, Korean and Japanese at 320, 375, 390, 430, 768, 820, 1024, 1194 and 1366px. Verified equal Date/Guest widths (within subpixel rounding), readable date text, no overlapping fields, input containment and no horizontal page scrolling. Exact 18-person count and ISO date persisted through language changes.
- Clicked the field itself at phone (375px) and tablet (820px) widths; native calendar opened. Keyboard selection in the native popup changed ISO dates and visible values correctly. Synthetic availability changed from 12:00 to 19:00 for the new date, old selected time cleared, and requests retained guests=18.
- This verifies pointer/native keyboard interaction, not physical touchscreen input. Native calendar popups are outside the webpage screenshot surface. Physical iPhone/iPad Safari and Android tap/selection, VoiceOver and portrait/landscape acceptance remain required before publication; no claim of physical iOS certification is made.

No booking rules, hours, capacity, 15+ logic, customer data, Staff permissions, Supabase, Aburii or GoDaddy settings changed. Customer WhatsApp stays removed; Staff WhatsApp/rejection features are untouched. The isolated test server was stopped.
