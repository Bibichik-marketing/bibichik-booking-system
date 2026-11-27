# Customer date and guest-grid responsive fix

The previous customer date-specific WebKit rules applied only below 760px. Tablet Safari therefore lacked the same inner-value sizing safeguards. Mobile rules also set appearance:none, suppressing native presentation. Empty Safari date inputs do not reliably display a placeholder. The shared grid could shrink its tracks without fully constraining the date control's native contents.

This fix adds a customer-only reserve-customer class; Staff/manual reservation forms do not receive it. Scoped date/grid rules use minmax(0,1fr), zero minimum inline sizes, border-box sizing and explicit maximum widths. The date keeps its native appearance/calendar, minimum readable value-box height and visible calendar indicator. Date and Guest Count stack below 600px. Touch/narrow date controls use 16px text to avoid Safari focus zoom. Existing colors, fonts/families, borders and normal spacing remain. A small translated empty-date hint is associated with the input; native placeholder is supplied where supported. The hint disappears once a real date is selected. No fake date value or input-type switching is used.

## Verification

- TypeScript, ESLint, 160 automated tests and production build passed.
- New regression test checks empty-date guidance in all five languages, native type/min validation and absence of customer-only changes in embedded Staff forms.
- Used an isolated hydrated Next.js copy with no environment files, credentials or Supabase configuration. Availability requests after choosing dates remained local and returned unavailable; no remote database was contacted and no booking was submitted.
- 90 responsive cases passed: empty and selected dates, all five customer languages, at 320, 375, 390, 430, 768, 820, 1024, 1194 and 1366px. Verified no horizontal overflow, no Date/Guest overlap, field containment, localized empty-date hint and preserved selected date through language switches.
- Opened the native calendar from its visible control at 820px and 375px. Keyboard selection within the native calendar changed the value to valid dates, reflected in the visible/accessibility value and unchanged availability request format. Native popup UI is outside the webpage screenshot surface; direct touch-cell selection could not be certified.
- Physical iPhone/iPad Safari and Android touch tests remain necessary. Viewport resizing and pointer/keyboard automation are not full physical-device or touchscreen certification. Check empty/selected date, icon tap, portrait/landscape, software keyboard and native date selection before publication.

Only customer presentation/copy was changed. Malaysia date minimum, selected-date state, booking availability, operating hours, 15+ exact-count logic, capacities and reservation workflow are unchanged. Customer WhatsApp remains removed; Staff Dashboard and its WhatsApp/rejection features are unchanged. No Supabase, feature flag, Aburii or GoDaddy changes were performed. The isolated server was stopped after testing.
