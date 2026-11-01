# Travel Planning and Booking Platform

Software Project I, Winter 2026. NestJS + MongoDB Atlas backend, Next.js frontend (Milestone 2).

## Setup (backend)

1. Install Node.js LTS, Git and VS Code.
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
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: only needed if you run the seed
5. Start the server: `npm run start:dev`
6. Open Swagger UI: http://localhost:3001/api/docs

The seed (`npm run seed`) loads the reference data (countries, cities, airports with time zones, attractions) and creates the admin account. The database is shared, so it only needs to be run once by one person.

## Git workflow

- `main` holds milestone releases. `develop` is the integration branch. Nobody commits to either directly.
- Branch from `develop`: `feature/<REQ-ID>-<description>`, e.g. `feature/FLT-11-flight-search`.
- Commit messages: `feat(flights): add round-trip search`. Put requirement IDs in branches, commits and PR descriptions.
- Open a pull request into `develop`. The team leader reviews and merges.
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

Ownership checks (a user may only touch their own bookings and itineraries) go in your service: compare the document's owner with `user.id`.

**Schemas.** Reference fields must be declared like this:

```ts
import { Schema as MongooseSchema } from 'mongoose';
@Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
userId: Types.ObjectId;
```

Never use `Types.ObjectId` as the `type:` option; queries by id silently match nothing.

**Shared code** (`backend/src/common`):
- `enums/`: `Role`, `BookingStatus`, `UserStatus`
- `utils/pagination.ts` and `dto/pagination-query.dto.ts`: page size 10 (GEN-05)
- `filters/all-exceptions.filter.ts`: every error has the same JSON shape (do not return custom error formats)

**Notifications and audit log** (global, just inject them):

```ts
await this.notifications.notify(userId, NotificationType.BOOKING_CONFIRMED, 'Booking confirmed', { bookingId });
await this.audit.log({ actorId: admin.id, action: AuditAction.USER_SUSPENDED, targetType: 'user', targetId });
```

**Reference data** (`ReferenceDataService`): `findAirport(iata)` returns the airport with its IANA `timezone` (use it for GEN-06). City, airport and country ids are strings (`cairo`, `CAI`, `EG`), as in the official dataset.

**Swagger.** Every endpoint needs `@ApiTags` and `@ApiOperation({ summary, description: 'REQ-ID' })`, and DTO fields need `@ApiProperty`. The backend is graded through Swagger UI.

**Booking lifecycle (GEN-11).** Only these status changes are allowed: Pending Payment to Confirmed, Pending Payment to Expired, Confirmed to Completed, Confirmed to Cancelled.

## Module ownership

| Module | Folder | Requirements |
|---|---|---|
| Auth, users, notifications, audit, seed | `auth`, `users`, `notifications`, `audit`, `seed` | ACC, GEN |
| Admin and moderation | `admin` | ACC-13 to 17, GEN-09, GEN-10 |
| Airlines and flights | `airlines`, `flights` | FLT-01 to 17, 30 |
| Flight bookings | `flight-bookings` | FLT-19 to 29 |
| Hotels | `hotels` | HTL-01 to 15 |
| Hotel bookings and reviews | `hotel-bookings` | HTL-16 to 26 |
| Payments and refunds | `payments` | PAY-01 to 04 |
| Itineraries | `itineraries` | ITN |
| Blog | `blog` | BLG |

## Troubleshooting

**`querySrv ECONNREFUSED` when starting the backend.** Some networks block the `mongodb+srv://` lookup. Use the non-SRV connection string (Atlas, Connect, Drivers, turn on "Legacy URI String"), or set your DNS to `8.8.8.8` and `1.1.1.1` and run `ipconfig /flushdns`.

**Login returns 200 but `/api/auth/me` returns 401.** The access cookie lasts 15 minutes. Call `POST /api/auth/refresh` or log in again. If your browser refuses Secure cookies on http, set `COOKIE_SECURE=false` in `.env` and restart.

**`.env` changes do not apply.** Watch mode only reloads code. Stop the server and start it again.