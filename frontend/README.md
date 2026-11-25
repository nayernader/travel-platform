# Travel Platform: frontend (Milestone 2)

Next.js 16 (App Router, TypeScript, Tailwind CSS 4). It talks to the NestJS backend in `../backend`.

## Run it

1. Start the backend first (`cd backend`, `npm run start:dev`, port 3001). In `backend/.env`, use `COOKIE_SECURE=false` for local http.
2. In a second terminal:
   ```
   cd frontend
   npm install
   copy .env.example .env.local
   npm run dev
   ```
3. Open http://localhost:3000. The home page shows "Connected" when the backend answers.

## How the frontend reaches the backend

`next.config.ts` forwards every `/api/...` and `/uploads/...` request to the backend (`BACKEND_URL`, default `http://localhost:3001`).
The browser only ever sees `http://localhost:3000`, so the httpOnly login cookies work without CORS, and the tokens are never readable by JavaScript (ACC-19).

## Rules for everyone

- **Call the backend only through `api` from `src/lib/api.ts`**, in Client Components (`"use client"`):
  ```ts
  import { api, errorMessages } from "@/lib/api";
  const flights = await api.get<Page<Flight>>("/flights/search", { from: "CAI", to: "DXB", date: "2026-12-20", passengers: 1 });
  await api.post("/flight-bookings", body);
  ```
  It sends the cookies, refreshes an expired login once on 401, sends users with a temporary password to `/change-password`, and throws `ApiError` (`status`, `code`, `messages`).
- **Show backend errors** with `<FormErrors messages={errorMessages(err)} />`. Never invent your own error texts for backend rules.
- **Who is logged in:** `const { user, loading, login, logout, reloadUser } = useAuth();`
- **Pages that need login or a role:** wrap them:
  ```tsx
  <RequireAuth roles={["airline_moderator"]}> ... </RequireAuth>
  ```
  This is only for a nicer experience. The backend still checks login, roles and ownership (GEN-13).
- **Types** for backend data go in `src/lib/types.ts` (one section per module).
- **Lists are paginated by 10** (`Page<T>`: `items`, `total`, `page`). Every list page needs paging buttons.
- **States:** every page shows loading, error and empty states, and asks for confirmation before destructive actions (cancel, delete).
- **Images** from the backend are under `/uploads/...` and work as `<img src={url} />`.

## UI kit (use it, do not restyle by hand)

Everything is in `src/components/ui` and imported from one place:

```tsx
import { Button, ButtonLink, Card, Input, Select, Textarea, Checkbox, Alert, Badge, StatusBadge,
  LoadingState, EmptyState, ConfirmDialog, Pagination, PageContainer, PageHeader } from "@/components/ui";
```

| Need | Use |
|---|---|
| A page | `<PageContainer><PageHeader title="My bookings" actions={...} />...</PageContainer>` |
| Buttons | `<Button loading={busy}>Save</Button>`, `variant="secondary" / "outline" / "danger" / "ghost"`, `<ButtonLink href="/x">` |
| Form fields | `<Input label="Email" error={...} hint={...} />`, `<Select>`, `<Textarea>`, `<Checkbox label=... />` |
| Backend errors | `<FormErrors messages={errorMessages(err)} />` |
| Loading / empty | `<LoadingState />`, `<EmptyState title="No bookings yet" action={...} />` |
| Destructive action | `<ConfirmDialog open title="Cancel this booking?" danger onConfirm onCancel />` |
| Booking status | `<StatusBadge status={booking.status} />` (Pending payment, Confirmed, Completed, Expired, Cancelled) |
| Lists of 10 | `<Pagination page={data.page} total={data.total} onPageChange={setPage} />` |
| Moderator / admin pages | `<DashboardShell title="Airline dashboard" items={[...]}>` from `@/components/dashboard-shell` |

| 3D hover card | `<TiltCard className="h-64 ...">` (tilts toward the mouse, off for "reduce motion") |
| Login-style page | `<AuthShell title="...">` from `@/components/auth-shell` |

The home page is an editorial, full-screen photo layout (warm cream, forest and brass colors, serif headings) (photos go in `public/images`, see `public/images/README.md`; missing photos show a gradient). Home-page helpers you can reuse: `<Photo>` (cover photo with fallback), `<Reveal>` (fade in on scroll). On phones there is an app-style bottom bar (`mobile-tab-bar.tsx`). The navbar floats over the photo on `/` only (`OVERLAY_PAGES` in `navbar.tsx`).

It also has a 3D globe (`src/components/globe.tsx`, the `cobe` package) with our 8 destinations from `src/lib/destinations.ts`.

**Search links from the home page** (the results pages must read these query parameters):
- `/flights?from=CAI&to=DXB&date=2026-12-20&passengers=1` (Member 3)
- `/hotels?city=cairo&checkIn=2026-12-20&checkOut=2026-12-23&guests=2` (Member 5)

Colors: `brand` (forest green), `accent` (brass), `night-900` (ink), `cream` and `sand`, for example `bg-brand-600`, `text-accent-600`, `bg-cream`. They are defined once in `src/app/globals.css`. Headings (h1 to h3) use the serif display font automatically; use `<em className="italic">` inside a heading for the elegant italic accent.
The app is light-only on purpose (readable on every computer, whatever the system theme).

## Pages and owners (Milestone 2)

Each route below exists as a placeholder (`ComingSoon`) that shows its owner. Replace the placeholder with your real page,
and add sub-pages in the same folder (for example `src/app/flights/[id]/page.tsx`). Add your link to `LINKS` in `src/components/navbar.tsx` only if it is new.

| Route | Owner | Requirements |
|---|---|---|
| `/login`, `/register`, `/profile`, `/change-password` | Member 1 | ACC (done) |
| `/favourites`, admin analytics inside `/admin` | Member 1 | BON-02, BON-01 |
| `/dashboard/airline` | Member 2 | FLT-01 to FLT-10, FLT-30 |
| `/flights`, flight part of `/bookings` | Member 3 | FLT-11 to FLT-29 |
| `/dashboard/hotel` | Member 4 | HTL-01 to HTL-10 |
| `/hotels`, hotel part of `/bookings`, reviews | Member 5 | HTL-11 to HTL-24 |
| Checkout, payment and refund screens inside the booking flows | Member 6 | PAY-01 to PAY-04 |
| `/itineraries`, `/explore` | Member 7 | ITN |
| `/blog`, `/admin` | Member 8 | BLG, ACC-13 to ACC-17, GEN-09, GEN-10 |

## Folder layout

```
src/
  app/              one folder per page (App Router): login, register, profile, flights, hotels, ...
  components/       shared UI (navbar, require-auth, form-errors, ...)
  context/          auth-context (useAuth)
  lib/              api.ts (backend calls), types.ts (shared types)
```

Put module-specific components in `src/components/<module>/` (for example `src/components/flights/flight-card.tsx`).

## Checks before a pull request

```
npm run lint
npm run build
```

Both must pass.
