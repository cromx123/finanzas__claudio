// Categorical series palette for multi-color composition bars — 7 hues
// validated (CVD + contrast, both themes) against this app's surfaces via
// the dataviz skill; see app/globals.css for the --color-cat-* values.
// Red is deliberately excluded from the rotation: the app's accent red
// already means "loss/negative" everywhere else in the UI.
const CATEGORICAL_SLOTS = [
  "var(--color-cat-1)",
  "var(--color-cat-2)",
  "var(--color-cat-3)",
  "var(--color-cat-4)",
  "var(--color-cat-5)",
  "var(--color-cat-6)",
  "var(--color-cat-7)",
];
const OTHER_COLOR = "var(--color-neutral-500)";
export const OTHER_LABEL = "Otros";

export interface CategoricalSegment {
  label: string;
  value: number;
  color: string;
}

/**
 * Buckets a list of (label, value) pairs into at most CATEGORICAL_SLOTS.length
 * named segments, largest first, folding anything past that cap into a
 * single "Otros" segment — never generates a color past the validated set.
 */
export function toCategoricalSegments<T>(
  items: T[],
  getLabel: (item: T) => string,
  getValue: (item: T) => number
): CategoricalSegment[] {
  const sorted = [...items].sort((a, b) => getValue(b) - getValue(a));
  const head = sorted.slice(0, CATEGORICAL_SLOTS.length).map((item, i) => ({
    label: getLabel(item),
    value: getValue(item),
    color: CATEGORICAL_SLOTS[i],
  }));
  const rest = sorted.slice(CATEGORICAL_SLOTS.length);
  if (rest.length > 0) {
    head.push({ label: OTHER_LABEL, value: rest.reduce((sum, item) => sum + getValue(item), 0), color: OTHER_COLOR });
  }
  return head;
}
