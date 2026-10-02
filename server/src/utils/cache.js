/**
 * Map.set that keeps the map at most `max` entries by dropping the oldest ones
 * (Maps keep insertion order). Stops in-memory caches from growing forever.
 */
export function setBounded(map, key, value, max = 2000) {
  map.delete(key); // re-insert so it becomes the newest
  map.set(key, value);
  while (map.size > max) map.delete(map.keys().next().value);
}
