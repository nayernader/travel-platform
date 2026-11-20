# Travel Planning and Booking Platform

Software Project I, Winter 2026. NestJS + MongoDB Atlas backend, Next.js frontend (Milestone 2).

## Milestone 1 status

- All backend modules are merged into `develop`: accounts and auth, admin and moderation, airlines and flights, flight bookings, hotels and rooms, hotel bookings and reviews, payments and refunds, exchange rates, itineraries and budgets, blog, notifications and audit log.
- Swagger UI: http://localhost:3001/api/docs (the backend is graded through Swagger UI)
- 141 endpoints; every endpoint that changes data requires login, and roles and ownership are checked on the backend (see [Security](#security-gen-13)).
- Unit tests: `npm test` (5 suites, 19 tests).

## Setup (backend)

1. Install **Node.js 24 LTS (24.9 or newer)**, Git and VS Code. Check with `node -v`.
2. Clone the repo and open it: `git clone https://github.com/nayernader/travel-platform.git`
3. Install dependencies:
   ```
   cd backend
   npm install
   ```
4. Create `backend/.env` (copy `.env.example`) and fill in the values:
   - `MONGODB_URI`: ask the team leader (never commit it)
   - `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: generate two different ones with
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `COOKIE_SECURE=false` when testing in Swagger over http://localhost
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: only needed if you run the seed
   - `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`: Stripe **test mode** keys, for payments
   - `SMTP_*`: an email account for verification and password-reset emails
5. Start the server: `npm run start:dev`
6. Open Swagger UI: http://localhost:3001/api/docs

The seed (`npm run seed`) loads the reference data (countries, cities, airports with time zones, attractions) and creates the admin account. The database is shared, so it only needs to be run once by one person.

### Environment variables

Names only; the values live in `backend/.env`, which is never committed.

| Group | Variables |
|---|---|
| Database | `MONGODB_URI` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECURE` |
| Seed | `ADMIN_EMAIL`, `ADMIN_PASSWORD` |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PLATFORM_CURRENCY` |
| Exchange rates | `EXCHANGE_RATE_API_KEY`, `EXCHANGE_RATE_API_URL` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| URLs | `PORT`, `APP_URL`, `FRONTEND_URL` |

## Test accounts

- **Admin:** the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`, created by `npm run seed`.
- **Traveler:** register with `POST /api/auth/register` (`name`, `email`, `password`, `consentAccepted: true`). New accounts are always role `user`; nobody can choose a role when registering.
- **Airline or hotel moderator:** an admin creates it with `POST /api/admin/moderators`, linked to an airline or hotel.
- The database is shared: start test emails with your member number (`m3.user@example.com`) so accounts don't collide.

## Running the checks

```
cd backend
npm run build                          # must finish without errors
npm test                               # unit tests (needs Node 24.9+)
cd ..
node backend/scripts/audit-routes.mjs  # lists every route and flags the ones without @Auth
```

## Security (GEN-13)

Validation, business rules and authorisation are enforced by the backend, whatever the frontend does:

- **Validation:** a global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`. Every request body is a DTO; missing, wrong-type or unknown fields (such as `"role": "admin"`) get 400.
- **Login and roles:** `@Auth(...)` checks the httpOnly access cookie, the account status (suspended, deactivated), the 30-minute inactivity limit and the role on every protected route. `backend/scripts/audit-routes.mjs` lists the public routes: only login and account flows, searches and public reads, reference data and the Stripe webhook.
- **Ownership:** users only reach their own bookings, payments, itineraries and posts; other users' records return 404. Moderators only manage their own airline or hotel. Shared helper: `backend/src/common/utils/ownership.ts`.
- **Passwords:** stored only as bcrypt salted hashes. Responses never contain `passwordHash` or the refresh token. Login locks for 15 minutes after 5 failed attempts. An admin password reset gives a temporary password that must be changed before anything else (`PASSWORD_CHANGE_REQUIRED`).
- **Payments:** the Stripe webhook verifies Stripe's signature before confirming a booking.
- **Public content:** only public, non-hidden itineraries and published, non-hidden posts are returned on public routes.

## Endpoints by module

All paths start with `/api`. Role "Logged in" means any logged-in account; "Public" needs no login.

### Auth and users (ACC)
| Method | Path | Role |
|---|---|---|
| POST | `/auth/register` | Public |
| POST | `/auth/verify-email` | Public |
| POST | `/auth/resend-verification` | Public |
| POST | `/auth/forgot-password` | Public |
| POST | `/auth/reset-password` | Public |
| GET | `/auth/verify-email-page`, `/auth/reset-password-page` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/refresh` | Public (refresh cookie) |
| POST | `/auth/logout` | Public |
| GET | `/auth/me` | Logged in |
| PATCH | `/auth/change-password` | Logged in |
| GET, PATCH | `/users/me` | Logged in |
| PATCH | `/users/me/deactivate` | Logged in (not admin) |
| GET | `/notifications`, `/notifications/unread-count` | Logged in |
| PATCH | `/notifications/read-all`, `/notifications/:id/read` | Logged in |

### Admin and moderation (ACC, GEN-09, GEN-10)
| Method | Path | Role |
|---|---|---|
| GET | `/admin/accounts` | Admin |
| PATCH | `/admin/accounts/:id/suspend`, `/admin/accounts/:id/reactivate` | Admin |
| PATCH | `/admin/users/:id/reset-password` | Admin |
| POST | `/admin/moderators` | Admin |
| PATCH | `/admin/providers/:type/:id/deactivate`, `/admin/providers/:type/:id/reactivate` | Admin |
| GET | `/admin/bookings` | Admin |
| GET | `/admin/audit-logs` | Admin |
| POST | `/reports` | User |
| GET | `/admin/reports` | Admin |
| PATCH | `/admin/reports/:id` | Admin |
| GET, DELETE | `/admin/content/:type/:id` | Admin |
| PATCH | `/admin/content/:type/:id/hide` | Admin |

### Airlines and flights (FLT)
| Method | Path | Role |
|---|---|---|
| POST | `/airlines` | Admin |
| GET | `/airlines/:id` | Public |
| PATCH | `/airlines/:id` | Admin or airline moderator |
| PUT | `/airlines/:id/baggage-policy`, `/airlines/:id/cancellation-policy` | Airline moderator |
| GET | `/flights/search`, `/flights/:id` | Public |
| POST | `/flights`, `/flights/:id/cabins`, `/flights/:id/cancel` | Airline moderator |
| PATCH | `/flights/:id`, `/flights/:id/cabins/:cabinId` | Airline moderator |
| GET | `/flights/:id/bookings`, `/flights/:id/passengers/export` | Airline moderator |

### Flight bookings (FLT)
| Method | Path | Role |
|---|---|---|
| POST | `/flight-bookings`, `/flight-bookings/hold` | User |
| GET | `/flight-bookings`, `/flight-bookings/:id` | User |
| GET | `/flight-bookings/:id/refund-preview`, `/flight-bookings/:id/e-ticket` | User |
| POST | `/flight-bookings/:id/cancel` | User |

### Hotels and rooms (HTL)
| Method | Path | Role |
|---|---|---|
| GET | `/hotels/search`, `/hotels/:id`, `/hotels/:id/rooms/available` | Public |
| POST | `/hotels` | Admin |
| PATCH | `/hotels/:id` | Admin or hotel moderator |
| POST | `/hotels/:id/photos` | Admin or hotel moderator |
| PUT | `/hotels/:id/policies` | Hotel moderator |
| GET, POST | `/hotels/:hotelId/rooms` | Hotel moderator |
| PATCH, DELETE | `/hotels/:hotelId/rooms/:roomId` | Hotel moderator |
| PATCH | `/hotels/:hotelId/rooms/:roomId/deactivate` | Hotel moderator |
| POST, PATCH | `/hotels/:hotelId/rooms/:roomId/availability` | Hotel moderator |
| GET | `/hotels/:id/reservations` | Hotel moderator |

### Hotel bookings and reviews (HTL)
| Method | Path | Role |
|---|---|---|
| POST | `/hotel-bookings` | User |
| GET | `/hotel-bookings`, `/hotel-bookings/:id` | Logged in (own bookings) |
| GET | `/hotel-bookings/:id/cancel-preview` | Logged in (own bookings) |
| POST | `/hotel-bookings/:id/cancel` | Logged in (own bookings) |
| POST | `/hotel-bookings/:id/review` | Logged in (after a completed stay) |
| PATCH, DELETE | `/reviews/:id` | Logged in (own review) |
| GET | `/hotels/:id/reviews` | Public |

### Payments, refunds and exchange rates (PAY)
| Method | Path | Role |
|---|---|---|
| GET | `/bookings/:type/:id/policies` | Logged in |
| POST | `/bookings/:type/:id/accept-policies` | Logged in |
| POST | `/payments` | Logged in (own booking) |
| POST | `/payments/:id/retry` | Logged in (own payment) |
| GET | `/payments/:id` | Logged in (own payment) |
| POST | `/payments/webhook` | Stripe (signature checked) |
| GET | `/refunds/:id`, `/bookings/:type/:id/refund` | Logged in (own booking) |
| GET | `/exchange-rates` | Public |

### Itineraries and budgets (ITN)
| Method | Path | Role |
|---|---|---|
| POST, GET | `/itineraries` | User |
| GET, PATCH, DELETE | `/itineraries/:id` | User (owner) |
| POST | `/itineraries/:id/days` | User (owner) |
| PATCH | `/itineraries/:id/days/reorder`, `/itineraries/:id/days/:dayId` | User (owner) |
| DELETE | `/itineraries/:id/days/:dayId` | User (owner) |
| POST | `/itineraries/:id/days/:dayId/activities` | User (owner) |
| PATCH, DELETE | `/activities/:id` | User (owner) |
| POST | `/activities/:id/images` | User (owner) |
| DELETE | `/activities/:id/images/:imageId` | User (owner) |
| POST | `/itineraries/:id/days/:dayId/budgets`, `/itineraries/:id/transport-costs` | User (owner) |
| PATCH, DELETE | `/budgets/:id`, `/transport-costs/:id` | User (owner) |
| GET | `/itineraries/:id/budget-summary` | User (owner) |
| POST | `/itineraries/:id/bookings` | User (owner) |
| DELETE | `/itineraries/:id/bookings/:bookingId` | User (owner) |
| GET | `/itineraries/:id/hotels`, `/itineraries/:id/flights` | User (owner) |
| GET | `/itineraries/:id/pdf` | User |
| GET | `/itineraries/public/search`, `/itineraries/public/:id` | Public |
| POST | `/itineraries/public/:id/clone` | User |

### Blog (BLG)
| Method | Path | Role |
|---|---|---|
| GET | `/posts`, `/posts/search`, `/posts/:id`, `/tags/:tag/posts` | Public |
| GET | `/posts/:id/comments`, `/authors/:id` | Public |
| POST | `/posts` | Logged in |
| GET | `/posts/mine`, `/posts/mine/:id` | Logged in |
| PATCH, DELETE | `/posts/:id` | Logged in (author) |
| PATCH | `/posts/:id/itinerary` | Logged in (author, itinerary owner), BLG-13 optional: body `{ "itineraryId": "<id>" }` attaches one of your public itineraries, `{ "itineraryId": null }` detaches it. `GET /posts/:id` then returns it as `itinerary` while it stays public and not hidden |
| POST | `/posts/:id/images` | Logged in (author) |
| DELETE | `/posts/:id/images`, `/posts/:id/images/:imageId` | Logged in (author) |
| POST | `/posts/:id/comments` | Logged in |
| PATCH, DELETE | `/comments/:id` | Logged in (author) |
| POST, DELETE | `/posts/:id/like` | Logged in |

### Reference data (GEN-12)
| Method | Path | Role |
|---|---|---|
| GET | `/reference/countries`, `/reference/cities`, `/reference/airports`, `/reference/attractions` | Public |

## Git workflow

- `main` holds milestone releases. `develop` is the integration branch. Nobody commits to either directly.
- Branch from `develop`: `feature/<REQ-ID>-<description>`, e.g. `feature/FLT-11-flight-search`.
- Commit messages: `feat(flights): add round-trip search`. Put requirement IDs in branches, commits and PR descriptions.
- Open a pull request into `develop`. The team leader reviews and merges with "Create a merge commit".
- Run `git pull origin develop` into your branch regularly.
- Never commit `.env`.
- Log every AI prompt that helped you in `AI_PROMPTS.txt`.

## Backend conventions

**Protecting endpoints.** One decorator handles login, suspension, inactivity expiry and roles:

```ts
@Auth()                        // any logged-in user
@Auth(Role.ADMIN)              // admins only
@Auth(Role.AIRLINE_MODERATOR)  // airline moderators only
@Post()
create(@CurrentUser() user: UserDocument, @Body() dto: CreateXDto) { ... }
```

`@AllowTemporaryPassword()` marks the only routes a user with a temporary password may call (`GET /auth/me`, `PATCH /auth/change-password`). Do not add it anywhere else.

**Ownership.** A user may only touch their own records. Use the shared helper, which returns 404 for a missing record or someone else's:

```ts
import { assertOwnership, sameId } from '../common/utils/ownership';
const booking = assertOwnership(await this.model.findById(id), (b) => b.userId, user, { notFoundMessage: 'Booking not found' });
```

For lists, filter in the query: `find({ userId: user.id })`. Never compare ids with `===`; use `sameId(a, b)`.

**Schemas.** Reference fields must be declared like this:

```ts
import { Schema as MongooseSchema } from 'mongoose';
@Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
userId: Types.ObjectId;
```

Never use `Types.ObjectId` as the `type:` option; queries by id silently match nothing. In `findByIdAndUpdate` / `findOneAndUpdate`, use `{ returnDocument: 'after' }` (the `new` option is deprecated).

**Shared code** (`backend/src/common`):
- `enums/`: `Role`, `BookingStatus`, `UserStatus`, `NotificationType`, `AuditAction`
- `utils/pagination.ts` and `dto/pagination-query.dto.ts`: page size 10 (GEN-05)
- `utils/ownership.ts`: `assertOwnership`, `sameId`, `toIdString`
- `events/user-deactivation.event.ts`: booking modules answer `USER_DEACTIVATION_CHECK` with their count of future Confirmed bookings (ACC-12)
- `filters/all-exceptions.filter.ts`: every error has the same JSON shape. An error can carry a machine-readable code: `throw new ConflictException({ code: 'HAS_FUTURE_BOOKINGS', message: '...' })`

**Notifications and audit log** (global, just inject them):

```ts
await this.notifications.notify(userId, NotificationType.BOOKING_CONFIRMED, 'Booking confirmed', { bookingId });
await this.audit.log({ actorId: admin.id, action: AuditAction.USER_SUSPENDED, targetType: 'user', targetId });
```

**Reference data** (`ReferenceDataService`): `findAirport(iata)` returns the airport with its IANA `timezone` (use it for GEN-06). City, airport and country ids are strings (`cairo`, `CAI`, `EG`), as in the official dataset.

**Image uploads** (`UploadsService`, GEN-08): JPG or PNG only, 5 MB each, at most 5 images per item; files are checked by their real content, not just the extension.

**Swagger.** Every endpoint needs `@ApiTags` and `@ApiOperation({ summary, description: 'REQ-ID' })`, and DTO fields need `@ApiProperty`. The backend is graded through Swagger UI.

**Booking lifecycle (GEN-11).** Only these status changes are allowed: Pending Payment to Confirmed, Pending Payment to Expired, Confirmed to Completed, Confirmed to Cancelled.

## Module ownership

| Module | Folder | Requirements |
|---|---|---|
| Auth, users, notifications, audit, seed, uploads | `auth`, `users`, `notifications`, `audit`, `seed`, `uploads` | ACC, GEN |
| Admin and moderation | `admin` | ACC-13 to 17, GEN-09, GEN-10 |
| Airlines and flights | `airlines`, `flights` | FLT-01 to 17, 30 |
| Flight bookings | `flight-bookings` | FLT-19 to 29 |
| Hotels | `hotels` | HTL-01 to 15 |
| Hotel bookings and reviews | `hotel-bookings` | HTL-16 to 26 |
| Payments, refunds and exchange rates | `payments`, `exchange-rates` | PAY-01 to 04 |
| Itineraries | `itineraries` | ITN |
| Blog | `blog` | BLG |

## Troubleshooting

**`querySrv ECONNREFUSED` when starting the backend.** Some networks block the `mongodb+srv://` lookup. Use the non-SRV connection string (Atlas, Connect, Drivers, turn on "Legacy URI String"), or set your DNS to `8.8.8.8` and `1.1.1.1` and run `ipconfig /flushdns`.

**Login returns 200 but `/api/auth/me` returns 401.** The access cookie lasts 15 minutes. Call `POST /api/auth/refresh` or log in again. If your browser refuses Secure cookies on http, set `COOKIE_SECURE=false` in `.env` and restart.

**`.env` changes do not apply.** Watch mode only reloads code. Stop the server and start it again.

**`npm test` fails with "Must use import to load ES Module".** Your Node.js is older than 24.9. Update to the current Node 24 LTS.

**403 `PASSWORD_CHANGE_REQUIRED`.** An admin reset your password. Log in with the temporary password and call `PATCH /api/auth/change-password`.
