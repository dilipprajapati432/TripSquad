import mongoose from "mongoose";
import { HttpError } from "../middleware/errors.js";

// Two layers of protection so that when friends edit the same trip at the same
// moment, no change is lost:
//
// 1. An in-process lock: requests to the SAME document on this server wait in line.
// 2. Optimistic concurrency (Trip/Poll schemas): if another server instance saved
//    first, MongoDB rejects our save with a VersionError and we retry with fresh data.

const locks = new Map(); // key -> promise of the last queued job

export async function withLock(key, fn) {
  const previous = locks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((r) => (release = r));
  const chained = previous.then(() => current);
  locks.set(key, chained);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === chained) locks.delete(key);
  }
}

/**
 * Load a document, change it, save it — safely under concurrent edits.
 *
 *   await updateWithRetry(Trip, tripId, (trip) => { trip.places.push(...) })
 */
export function updateWithRetry(Model, id, mutate, attempts = 5) {
  return withLock(`${Model.modelName}:${id}`, async () => {
    for (let i = 0; i < attempts; i++) {
      const doc = await Model.findById(id);
      if (!doc) throw new HttpError(404, `${Model.modelName} not found`); // deleted meanwhile
      const result = await mutate(doc);
      try {
        await doc.save();
        return result === undefined ? doc : result;
      } catch (err) {
        if (err instanceof mongoose.Error.VersionError && i < attempts - 1) {
          // Another server saved first. Wait a tiny random moment, then retry with fresh data.
          await new Promise((r) => setTimeout(r, 10 + Math.random() * 40 * (i + 1)));
          continue;
        }
        throw err;
      }
    }
    return null;
  });
}
