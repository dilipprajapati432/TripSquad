import http from "node:http";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { createApp } from "./app.js";
import { setupSocket } from "./socket.js";

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error("❌ Could not connect to MongoDB. Check MONGO_URI in server/.env\n", err.message);
    process.exit(1);
  }
  const app = createApp();
  const server = http.createServer(app);
  setupSocket(server, env.clientUrl);
  server.listen(env.port, () => console.log(`🚀 TripSquad API running on http://localhost:${env.port}`));
}

start();
