import { io } from "socket.io-client";
import { API_URL, getToken } from "./api.js";

// One shared connection for the whole app, created after login.
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_URL, {
      auth: (cb) => cb({ token: getToken() }), // re-read the token on every reconnect
      autoConnect: true,
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
