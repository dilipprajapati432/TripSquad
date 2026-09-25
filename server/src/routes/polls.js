import { Router } from "express";
import mongoose from "mongoose";
import { Poll } from "../models/Poll.js";
import { HttpError } from "../middleware/errors.js";
import { updateWithRetry } from "../utils/retry.js";
import { serializePoll } from "../utils/serialize.js";
import { emitToTrip } from "../services/realtime.js";

// Mounted at /api/trips/:tripId/polls (loadTrip already ran)
const router = Router({ mergeParams: true });

async function findPoll(req) {
  const { pollId } = req.params;
  if (!mongoose.isValidObjectId(pollId)) throw new HttpError(404, "Poll not found");
  const poll = await Poll.findOne({ _id: pollId, trip: req.trip._id });
  if (!poll) throw new HttpError(404, "Poll not found");
  return poll;
}

function broadcast(req, poll) {
  // myVote is different for every viewer, so clients recompute it from `votes`
  emitToTrip(req.trip._id.toString(), "polls:updated", { poll: serializePoll(poll, null) });
}

router.get("/", async (req, res) => {
  const polls = await Poll.find({ trip: req.trip._id }).sort({ createdAt: -1 });
  res.json({ polls: polls.map((p) => serializePoll(p, req.user._id)) });
});

router.post("/", async (req, res) => {
  const question = String(req.body?.question || "").trim();
  const options = (Array.isArray(req.body?.options) ? req.body.options : [])
    .map((o) => String(o || "").trim())
    .filter(Boolean);
  if (question.length < 3) throw new HttpError(400, "Please write a question");
  if (options.length < 2 || options.length > 8) throw new HttpError(400, "A poll needs 2 to 8 options");
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) throw new HttpError(400, "Options must be different");

  const poll = await Poll.create({
    trip: req.trip._id,
    question,
    options: options.map((text) => ({ text, votes: [] })),
    createdBy: req.user._id,
  });
  broadcast(req, poll);
  res.status(201).json({ poll: serializePoll(poll, req.user._id) });
});

// One vote per person. Voting again moves your vote. Sending the same option again removes it.
router.post("/:pollId/vote", async (req, res) => {
  const existing = await findPoll(req);
  const index = Number(req.body?.option);
  if (!Number.isInteger(index) || index < 0 || index >= existing.options.length) throw new HttpError(400, "Invalid option");
  const me = req.user._id.toString();

  const poll = await updateWithRetry(Poll, existing._id, (p) => {
    if (p.closed) throw new HttpError(400, "This poll is closed");
    const hadThis = p.options[index].votes.some((v) => v.toString() === me);
    p.options.forEach((o) => {
      o.votes = o.votes.filter((v) => v.toString() !== me);
    });
    if (!hadThis) p.options[index].votes.push(req.user._id);
  });
  broadcast(req, poll);
  res.json({ poll: serializePoll(poll, req.user._id) });
});

router.post("/:pollId/close", async (req, res) => {
  const existing = await findPoll(req);
  if (existing.createdBy.toString() !== req.user._id.toString() && !req.trip.isOwner(req.user._id)) {
    throw new HttpError(403, "Only the poll creator or trip owner can close it");
  }
  const poll = await updateWithRetry(Poll, existing._id, (p) => {
    p.closed = true;
  });
  broadcast(req, poll);
  res.json({ poll: serializePoll(poll, req.user._id) });
});

router.delete("/:pollId", async (req, res) => {
  const poll = await findPoll(req);
  if (poll.createdBy.toString() !== req.user._id.toString() && !req.trip.isOwner(req.user._id)) {
    throw new HttpError(403, "Only the poll creator or trip owner can delete it");
  }
  await poll.deleteOne();
  emitToTrip(req.trip._id.toString(), "polls:deleted", { pollId: poll._id.toString() });
  res.json({ ok: true });
});

export default router;
