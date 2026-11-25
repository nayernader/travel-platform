// The 8 cities and airports of the official reference data (GEN-12), with coordinates for the globe.
export interface Destination {
  cityId: string;
  city: string;
  country: string;
  airport: string;
  location: [number, number]; // latitude, longitude
  gradient: string; // card artwork
  tagline: string;
}

export const DESTINATIONS: Destination[] = [
  { cityId: "cairo", city: "Cairo", country: "Egypt", airport: "CAI", location: [30.04, 31.24],
    gradient: "from-amber-200 via-orange-300 to-stone-500", tagline: "Pyramids, the Nile and old bazaars" },
  { cityId: "dubai", city: "Dubai", country: "United Arab Emirates", airport: "DXB", location: [25.2, 55.27],
    gradient: "from-orange-100 via-amber-300 to-stone-500", tagline: "Skylines, desert dunes and the sea" },
  { cityId: "london", city: "London", country: "United Kingdom", airport: "LHR", location: [51.5, -0.12],
    gradient: "from-stone-300 via-slate-400 to-stone-600", tagline: "Museums, parks and theatre nights" },
  { cityId: "paris", city: "Paris", country: "France", airport: "CDG", location: [48.86, 2.35],
    gradient: "from-rose-100 via-stone-300 to-stone-500", tagline: "Cafés, boulevards and the Seine" },
  { cityId: "new_york", city: "New York", country: "United States", airport: "JFK", location: [40.71, -74.0],
    gradient: "from-stone-200 via-stone-400 to-neutral-600", tagline: "Avenues, parks and Broadway" },
  { cityId: "tokyo", city: "Tokyo", country: "Japan", airport: "HND", location: [35.68, 139.69],
    gradient: "from-rose-200 via-stone-400 to-neutral-700", tagline: "Neon streets and quiet temples" },
  { cityId: "riyadh", city: "Riyadh", country: "Saudi Arabia", airport: "RUH", location: [24.71, 46.68],
    gradient: "from-amber-100 via-orange-200 to-stone-500", tagline: "Heritage quarters and modern towers" },
  { cityId: "frankfurt", city: "Frankfurt", country: "Germany", airport: "FRA", location: [50.11, 8.68],
    gradient: "from-emerald-100 via-stone-300 to-stone-600", tagline: "The Römerberg and the Main river" },
];

export const findDestination = (cityId: string) => DESTINATIONS.find((d) => d.cityId === cityId);
