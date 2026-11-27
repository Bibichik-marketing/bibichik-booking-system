# Staff date controls — responsive verification

## Cause and scope

The previous native date/time input safeguards stopped at 760px, leaving 768–1024px tablet widths subject to WebKit intrinsic date-control sizing. Operation forms also retained inline labels above 760px, while Staff cards used overflow:hidden. On narrow phones, filters were only forced onto their own rows at 430px.

This fix changes CSS only, scoped under .staff-shell and media queries up to 1024px. It sets explicit border-box/inline sizing for date, time and datetime-local inputs, preserves native picker appearance, gives WebKit date values a readable minimum height/alignment, and keeps calendar indicators from shrinking. Form labels constrain their children on tablets. Operation cards containing direct date forms allow overflow; native calendars remain browser/OS UI rather than custom popovers. Filters stack below 600px. Existing colors, typography, desktop rules above 1024px, native input types and all event handlers remain unchanged. Font size 16px on narrow native date controls avoids iOS focus zoom.

No date conversion, filtering logic, timezone, translation, booking payload, permissions, reservation rules, guest counts or rejection reasons changed. There is no new custom date picker or placeholder pretending to be native date content.

## Verification

- TypeScript, ESLint, all 159 automated tests and production build passed.
- Used a separate hydrated local Next.js Staff demo copy without environment files, credentials or Supabase access. No forms were submitted.
- 120 layout checks passed: Overview, Today's Reservations, Pending Approvals, Availability Timeline and Outlet Settings, in English/Chinese/Malay, at 320, 375, 390, 430, 768, 820, 1024 and 1440px. Date/time/datetime-local fields fit their form/filter containers and viewport, were at least 44px high, and introduced no horizontal page scrolling.
- Reservation edit fields passed at all eight widths; manual booking date fields also passed at all eight widths.
- Quota and closure start/end datetime values persisted across all three Staff languages. The existing selected list-filter date remained through navigation/language changes; Reset restored the fictional list.
- Opened the native calendar through its visible picker control at a 375px viewport. Native keyboard selection advanced the date and applied the filter without clipping or status changes. Native popup cells were not directly actionable through the available automation; date selection was verified using its keyboard interface.

## Remaining physical-device checks

Viewport resizing is not full touch-device emulation. No physical iPhone/iPad Safari or Android device was controlled. On iPhone widths 320/375/390/430 and tablets 768/820/1024, verify actual touch opening/selection, native date text and icon visibility, portrait/landscape and software-keyboard behaviour. Check populated and empty date controls, edit dialogs, manual booking, timeline and date ranges. Native calendar placement and mute/keyboard/OS presentation cannot be guaranteed by desktop CSS inspection alone.

No Supabase connection/migration, Production reservation/settings change, Aburii modification or GoDaddy publication was performed. The isolated demo server was stopped after testing.
