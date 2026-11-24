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
