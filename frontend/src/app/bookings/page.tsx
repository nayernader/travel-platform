import { redirect } from "next/navigation";

// /bookings opens the flight tab; the tabs are in layout.tsx
export default function BookingsPage() {
  redirect("/bookings/flights");
}
