// Sequential single-hue ramp for the country choropleth — same accent scale
// the rest of the app themes off (app/globals.css --color-accent-*).
// Lightest step means "small holding" and is allowed to recede toward the
// surface; countries with no holdings at all get a separate neutral fill
// (see WorldMap.tsx) so "near zero" is never confused with "no data."
const RAMP_LIGHT = { r: 0xff, g: 0xf2, b: 0xef }; // accent-100
const RAMP_DARK = { r: 0xae, g: 0x18, b: 0x00 }; // accent-700
const MIN_INTENSITY = 0.16; // floor so any holding, however small, stays visibly tinted

function toHex(n: number): string {
  return Math.round(n).toString(16).padStart(2, "0");
}

/** pct in [0, 1] (value relative to the largest single-country holding). */
export function accentRampColor(pct: number): string {
  const t = MIN_INTENSITY + Math.max(0, Math.min(1, pct)) * (1 - MIN_INTENSITY);
  const r = RAMP_LIGHT.r + (RAMP_DARK.r - RAMP_LIGHT.r) * t;
  const g = RAMP_LIGHT.g + (RAMP_DARK.g - RAMP_LIGHT.g) * t;
  const b = RAMP_LIGHT.b + (RAMP_DARK.b - RAMP_LIGHT.b) * t;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
