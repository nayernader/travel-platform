// Photos used by the home page. Put the files in frontend/public/images (see public/images/README.md).
// If a file is missing, the page shows a soft gradient instead, so nothing breaks.
export const MEDIA = {
  heroSlides: [1, 2, 3, 4, 5].map((n) => `/images/hero-${n}.jpg`),
  tile: (name: string) => `/images/tiles/${name}.jpg`,
  stay: "/images/stay.jpg",
  fly: "/images/fly.jpg",
  promo: "/images/promo.jpg",
  city: (cityId: string) => `/images/cities/${cityId}.jpg`,
};
