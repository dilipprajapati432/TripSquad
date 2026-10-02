/**
 * Text from a request body: strings (and numbers) only. Anything else — objects, arrays,
 * booleans — becomes "", so it fails the normal "please enter a name" checks instead of
 * being saved as the text "[object Object]".
 */
export function str(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}
