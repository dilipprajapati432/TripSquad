import { io } from "socket.io-client";
import { API_URL, getToken, reportUnauthorized } from "./api.js";

// One shared connection for the whole app, created after login.
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_URL, {
      auth: (cb) => cb({ token: getToken() }), // re-read the token on every reconnect
      autoConnect: true,
    });
    // The server rejects an expired login (and ends the connection when it expires): log out
    // instead of showing "Reconnecting…" forever.
    socket.on("connect_error", (err) => err?.message === "unauthorized" && reportUnauthorized());
    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") setTimeout(() => socket?.connect(), 1000); // re-check the token
    });
  }
  return socket;
}

export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
