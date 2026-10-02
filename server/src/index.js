import http from "node:http";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { createApp } from "./app.js";
import { setupSocket } from "./socket.js";

// Last line of defence: log unexpected errors instead of taking the whole server down.
process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));
process.on("uncaughtException", (err) => console.error("Uncaught exception:", err));

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error("Could not connect to MongoDB. Check MONGO_URI in server/.env\n", err.message);
    process.exit(1);
  }
  const app = createApp();
  const server = http.createServer(app);
  setupSocket(server, env.clientUrls);
  server.listen(env.port, () => console.log(`TripSquad API running on http://localhost:${env.port} (allowing ${env.clientUrls.join(", ")})`));

  // Hosts like Render send SIGTERM on every deploy: finish open requests, then close the database
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down…`);
    server.close(() => mongoose.connection.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10000).unref(); // don't hang forever on open sockets
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start();
