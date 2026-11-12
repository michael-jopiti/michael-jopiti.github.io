export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// scroll distance, in px, that takes the page from the home view to the about view
export const range = () => innerHeight * 0.8;
