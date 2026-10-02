import { Router } from "express";
import express from "express";
import crypto from "node:crypto";
import { Trip } from "../models/Trip.js";
import { CoverImage } from "../models/CoverImage.js";
import { HttpError } from "../middleware/errors.js";
import { requireOwner } from "../middleware/trip.js";
import { updateWithRetry } from "../utils/retry.js";
import { serializeCover } from "../utils/serialize.js";
import { detectImageType } from "../utils/image.js";
import { emitToTrip } from "../services/realtime.js";
import { announce } from "../services/activity.js";
import { suggestPhotos } from "../services/photos.js";
import { lookupCover } from "../services/tripPhotos.js";

// Mounted at /api/trips/:tripId/cover (loadTrip already ran). Only the trip owner changes the cover.
const router = Router({ mergeParams: true });
router.use(requireOwner);

const MAX_BYTES = 2 * 1024 * 1024; // the client resizes to ~1600px, so real uploads are ~200-400 KB
const newKey = () => crypto.randomBytes(18).toString("base64url"); // unguessable, part of the image URL

/** Save the new cover, then show it to everyone in the trip. */
async function setCover(req, res, cover, { message } = {}) {
  const trip = await updateWithRetry(Trip, req.trip._id, (t) => {
    t.cover = { ...cover, checkedAt: new Date() };
  });
  await sendCover(req, res, trip, message);
}

async function sendCover(req, res, trip, message) {
  // An uploaded photo that is no longer used is deleted. Look at what was actually saved,
  // so a request finishing at the same moment can't delete the photo that is now showing.
  if (trip.cover?.kind !== "upload") await CoverImage.deleteOne({ trip: trip._id });
  else if (!(await CoverImage.exists({ trip: trip._id, key: trip.cover.url.split("/").pop() }))) {
    throw new HttpError(409, "The cover was changed at the same moment. Please try again.");
  }
  const data = serializeCover(trip);
  emitToTrip(String(trip._id), "trip:cover", { tripId: String(trip._id), cover: data });
  if (message) await announce(trip._id, req.user._id, `${req.user.name} ${message}`, { icon: "cover" });
  res.json({ cover: data });
}

// Other photos of the destination to choose from
router.get("/suggestions", async (req, res) => {
  let photos;
  try {
    photos = await suggestPhotos(req.trip.destination, { limit: 8 });
  } catch {
    throw new HttpError(502, "Couldn't load photo suggestions right now. Try again in a moment.");
  }
  res.json({ photos: photos.map(({ url, page, credit, title }) => ({ url, page, credit, title })) });
});

// Upload your own photo: the request body is the image file itself (not JSON)
router.put("/image", express.raw({ type: "image/*", limit: MAX_BYTES }), async (req, res) => {
  const type = detectImageType(req.body);
  if (!type) throw new HttpError(400, "Please upload a JPEG, PNG or WebP image.");
  const key = newKey();
  await CoverImage.findOneAndUpdate(
    { trip: req.trip._id },
    { trip: req.trip._id, key, data: req.body, contentType: type, uploadedBy: req.user._id },
    { upsert: true }
  );
  await setCover(req, res, { kind: "upload", url: `/api/covers/${key}`, page: "", credit: "", position: 50 }, { message: "changed the trip cover" });
});

// Pick a suggested photo, go back to the automatic one, or remove the photo
router.put("/", async (req, res) => {
  const type = req.body?.type;
  if (type === "pick") {
    // Only photos we suggested for this destination can be picked (no arbitrary URLs)
    const photos = await suggestPhotos(req.trip.destination, { limit: 8 }).catch(() => []);
    const photo = photos.find((p) => p.url === req.body?.url);
    if (!photo) throw new HttpError(400, "That photo isn't one of the suggestions for this destination.");
    return setCover(req, res, { kind: "pick", url: photo.url, page: photo.page, credit: photo.credit, position: 50 }, { message: "changed the trip cover" });
  }
  if (type === "auto") {
    const found = await lookupCover(req.trip.destination);
    if (!found) throw new HttpError(502, "Couldn't reach the photo service. Try again in a moment.");
    return setCover(req, res, { ...found, kind: "auto", position: 50 }, { message: "reset the trip cover" });
  }
  if (type === "none") return setCover(req, res, { kind: "none", position: 50 }, { message: "removed the trip cover photo" });
  throw new HttpError(400, "Unknown cover change");
});

// Which part of the photo shows in the banner (dragged in the cover editor)
router.patch("/position", async (req, res) => {
  const position = Math.round(Number(req.body?.position));
  if (!Number.isFinite(position) || position < 0 || position > 100) throw new HttpError(400, "Position must be between 0 and 100");
  // Change only the position, on the latest saved cover (the photo may have changed since this page loaded)
  const trip = await updateWithRetry(Trip, req.trip._id, (t) => {
    if (!t.cover?.url || t.cover.kind === "none") throw new HttpError(400, "This trip has no cover photo");
    t.cover.position = position;
  });
  await sendCover(req, res, trip);
});

export default router;

/** Public: GET /api/covers/:key — the URL itself is the secret (like a shared photo link). */
export async function serveCoverImage(req, res) {
  const key = String(req.params.key || "");
  if (!/^[\w-]{20,40}$/.test(key)) throw new HttpError(404, "Not found");
  const img = await CoverImage.findOne({ key }).select("data contentType");
  if (!img) throw new HttpError(404, "Not found");
  res.set({
    "Content-Type": img.contentType,
    "Cache-Control": "public, max-age=31536000, immutable", // a new upload gets a new key
    "Cross-Origin-Resource-Policy": "cross-origin", // the web app runs on another origin
    "X-Content-Type-Options": "nosniff",
  });
  res.send(img.data);
}
