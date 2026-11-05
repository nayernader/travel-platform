export const COUNTRIES = [
  { _id: 'EG', name: 'Egypt', currency: 'EGP' },
  { _id: 'AE', name: 'United Arab Emirates', currency: 'AED' },
  { _id: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { _id: 'US', name: 'United States', currency: 'USD' },
  { _id: 'FR', name: 'France', currency: 'EUR' },
  { _id: 'DE', name: 'Germany', currency: 'EUR' },
  { _id: 'JP', name: 'Japan', currency: 'JPY' },
  { _id: 'SA', name: 'Saudi Arabia', currency: 'SAR' },
];

export const CITIES = [
  { _id: 'cairo', name: 'Cairo', countryCode: 'EG' },
  { _id: 'dubai', name: 'Dubai', countryCode: 'AE' },
  { _id: 'london', name: 'London', countryCode: 'GB' },
  { _id: 'new_york', name: 'New York', countryCode: 'US' },
  { _id: 'paris', name: 'Paris', countryCode: 'FR' },
  { _id: 'tokyo', name: 'Tokyo', countryCode: 'JP' },
  { _id: 'riyadh', name: 'Riyadh', countryCode: 'SA' },
  { _id: 'frankfurt', name: 'Frankfurt', countryCode: 'DE' },   // NEW
];

// Each airport includes its IANA time zone, as in the official Airports.csv (FLT-02)
export const AIRPORTS = [
  { _id: 'CAI', name: 'Cairo International Airport', cityId: 'cairo', countryCode: 'EG', timezone: 'Africa/Cairo' },
  { _id: 'DXB', name: 'Dubai International Airport', cityId: 'dubai', countryCode: 'AE', timezone: 'Asia/Dubai' },
  { _id: 'LHR', name: 'Heathrow Airport', cityId: 'london', countryCode: 'GB', timezone: 'Europe/London' },
  { _id: 'JFK', name: 'John F. Kennedy International Airport', cityId: 'new_york', countryCode: 'US', timezone: 'America/New_York' },
  { _id: 'CDG', name: 'Charles de Gaulle Airport', cityId: 'paris', countryCode: 'FR', timezone: 'Europe/Paris' },
  { _id: 'HND', name: 'Haneda Airport', cityId: 'tokyo', countryCode: 'JP', timezone: 'Asia/Tokyo' },
  { _id: 'RUH', name: 'King Khalid International Airport', cityId: 'riyadh', countryCode: 'SA', timezone: 'Asia/Riyadh' },
  { _id: 'FRA', name: 'Frankfurt Airport', cityId: 'frankfurt', countryCode: 'DE', timezone: 'Europe/Berlin' },   // NEW
];

export const ATTRACTIONS = [
  { _id: 'att-1', name: 'Giza Pyramids and Sphinx', cityId: 'cairo' },
  { _id: 'att-2', name: 'Burj Khalifa Observation Deck', cityId: 'dubai' },
  { _id: 'att-3', name: 'British Museum', cityId: 'london' },
  { _id: 'att-4', name: 'Central Park', cityId: 'new_york' },
  { _id: 'att-5', name: 'Louvre Museum', cityId: 'paris' },
  { _id: 'att-6', name: 'Senso-ji Temple', cityId: 'tokyo' },
  { _id: 'att-7', name: 'Kingdom Centre Tower (Sky Bridge)', cityId: 'riyadh' },
  { _id: 'att-8', name: 'Römerberg', cityId: 'frankfurt' },   // NEW
];