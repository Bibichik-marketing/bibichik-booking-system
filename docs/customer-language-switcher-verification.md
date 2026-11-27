# Customer language selector — phone/tablet fix

The native details selector previously closed on every blur whose relatedTarget was outside the disclosure, including a null relatedTarget. Safari touch interaction can produce null focus targets before an option click, removing the option before its handler runs. The selector now closes only for a known outside focus target. Existing outside-pointer dismissal, Escape and arrow-key navigation remain. Native details/summary and the existing design are retained.

The dropdown now has viewport-bounded height, internal scrolling, explicit border-box sizing and a header stacking level above customer content. Existing compact-phone/full-tablet labels and safe-area positioning remain. Locale switching still uses the installed Next.js documented native history integration, without remounting the booking form, page navigation, storage or a customer-data export.

## Local verification

- 159 tests, TypeScript, ESLint and production build passed.
- Added regression coverage for Safari-style null blur before option click, inside/outside focus transitions and all five option handlers.
- Used a separate hydrated Next.js local app copy without environment files, credentials or database connections, in demo mode only.
- Passed 40 browser switches: five languages at 320, 375, 390, 430, 768, 820, 1024 and 1440 pixels. Verified translated page language, locale pathname, preserved demo query, no horizontal overflow, dropdown viewport fit and unobscured click targets.
- Preserved the distinct 15+ selection and exact guest count (18) through every switch.
- Guest-details checks at the same widths/languages preserved name, special requests, consent, date/time and party summary. Phone/email values were masked by browser tooling; their exact values were not independently asserted. No request was submitted.
- Keyboard Escape closed the menu. Automated component coverage retains all five native labels and active selection, URL query/hash preservation and no browser storage of customer data.

## Physical-device acceptance still required

No physical iPhone, iPad, Android phone or Android tablet was controlled in this review. Responsive desktop browser checks are not device certification. On iPhone Safari, Android Chrome, iPad Safari and Android tablet Chrome:

1. Open a separately authorized demo/non-Production preview; enter synthetic data only.
2. Tap the selector and each of English, 简体中文, Bahasa Melayu, 한국어 and 日本語. Check short phone labels/full tablet labels, scrolling, portrait/landscape, safe areas and the software keyboard.
3. Switch while the exact-count input and later guest-information fields are populated. Verify exact phone/email values manually as well as other fields; do not submit a real reservation.
4. Check outside tap, keyboard Tab/arrows/Escape where available, and no overlays intercepting options.
5. Confirm 15+ and exact guest counts remain distinct and customer WhatsApp links stay absent. Staff WhatsApp is unchanged.

No Supabase migration, feature flag, booking switch, Production data, Aburii change or GoDaddy deployment was performed. Larger-party migration approval/activation remains separate.
