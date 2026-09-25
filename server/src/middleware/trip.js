import mongoose from "mongoose";
import { Trip } from "../models/Trip.js";
import { HttpError } from "./errors.js";

/** Loads req.trip for routes with :tripId and checks the logged-in user is a member. */
export async function loadTrip(req, _res, next) {
  const { tripId } = req.params;
  if (!mongoose.isValidObjectId(tripId)) throw new HttpError(404, "Trip not found");
  const trip = await Trip.findById(tripId);
  // Same error for "doesn't exist" and "not a member" so people can't probe trip ids
  if (!trip || !trip.isMember(req.user._id)) throw new HttpError(404, "Trip not found");
  req.trip = trip;
  next();
}

export function requireOwner(req, _res, next) {
  if (!req.trip.isOwner(req.user._id)) throw new HttpError(403, "Only the trip owner can do this");
  next();
}
