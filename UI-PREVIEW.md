# UI design review

Run npm run dev -- --hostname 127.0.0.1 --port 3197.

Customer: http://127.0.0.1:3197/en/reserve?demo=1
Staff: http://127.0.0.1:3197/staff?demo=1

Server page components only enable the demo prop when NODE_ENV is development and demo=1. No public environment toggle is used. Demo slots and guests are fictional. Demo components skip fetch and submission APIs; changes exist only in React memory and reset on reload. Production ignores demo=1 and retains normal authentication. Production HTTP checks verified no demo banners and the staff login remained present.

Desktop and 390px mobile layouts were inspected in Chrome. The customer demo was exercised through guest information to its explicitly fictional Pending Confirmation preview. Staff details and demo approval updated only local sample state. Tables scroll within their panel on narrow screens; sidebar navigation becomes a horizontal mobile navigation. Native dialog handles keyboard focus trapping and Escape.

TypeScript, ESLint, all three validation tests and the webpack production build passed. Database migrations were not changed. Real authentication, database capacity and integration end-to-end tests remain pending Supabase setup. Staff lists continue to use five-second polling. The calendar is a two-week day selector plus date filtering, not a full month scheduling editor.
