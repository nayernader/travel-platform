// FLT-22 race test: fire several holds for the last seat at the same moment.
// Exactly one must succeed (201); all others must get 409, and seats must never go below 0.
//
// Usage (PowerShell, from the backend folder, server running):
//   $env:RACE_EMAIL="your-user@example.com"; $env:RACE_PASSWORD="your-password"; node test/race-hold.mjs

const BASE = process.env.API_URL ?? 'http://localhost:3001/api';
const FLIGHT_ID = process.env.RACE_FLIGHT_ID ?? '6aef9839d9d269130f4a57dc'; // TST302
const CABIN = process.env.RACE_CABIN ?? 'Economy';
const N = Number(process.env.RACE_N ?? 5); // how many requests at once

const email = process.env.RACE_EMAIL;
const password = process.env.RACE_PASSWORD;
if (!email || !password) {
  console.error('Set RACE_EMAIL and RACE_PASSWORD first.');
  process.exit(1);
}

async function seatsLeft() {
  const res = await fetch(`${BASE}/flights/${FLIGHT_ID}`);
  const flight = await res.json();
  return flight.cabins.find((c) => c.cabinClass === CABIN).availableSeats;
}

// 1. log in once as a normal user and keep the cookies
const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) {
  console.error('Login failed:', login.status, await login.text());
  process.exit(1);
}
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');

// 2. the same booking request, one adult
const body = JSON.stringify({
  segments: [{ flightId: FLIGHT_ID, cabinClass: CABIN }],
  passengers: [
    { fullName: 'Race Tester', dateOfBirth: '1995-04-12', passportNumber: 'R12345678', type: 'ADULT' },
  ],
});

const before = await seatsLeft();
console.log(`Seats before: ${before}. Sending ${N} holds at the same time...`);

// 3. fire all requests at once
const responses = await Promise.all(
  Array.from({ length: N }, () =>
    fetch(`${BASE}/flight-bookings/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body,
    }),
  ),
);
const statuses = responses.map((r) => r.status);
const after = await seatsLeft();

const won = statuses.filter((s) => s === 201).length;
const lost = statuses.filter((s) => s === 409).length;
console.log('Statuses:', statuses.join(', '));
console.log(`201: ${won}, 409: ${lost}, seats after: ${after}`);

// 4. verdict
const expectedWins = Math.min(before, N);
const pass = won === expectedWins && lost === N - expectedWins && after === before - expectedWins && after >= 0;
console.log(pass ? 'PASS: no overbooking' : 'FAIL: overbooking or unexpected result');
process.exit(pass ? 0 : 1);