// Small fetch wrapper: adds the login token, parses JSON, and throws readable errors.

// No trailing slash, or requests would go to "//api/..." and miss every route
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const TOKEN_KEY = "tripsquad_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: stay logged in for this tab only */
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}
/** For other transports (the socket) that find out the login has expired. */
export function reportUnauthorized() {
  if (getToken()) onUnauthorized();
}

export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Can't reach the server. Is it running?");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** Upload a file (e.g. a trip cover) as the raw request body. */
export async function uploadFile(path, blob, { method = "PUT" } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: { "Content-Type": blob.type || "application/octet-stream", ...(token && { Authorization: `Bearer ${token}` }) },
      body: blob,
    });
  } catch {
    throw new Error("Can't reach the server. Is it running?");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  return data;
}

/** Image URLs from our API are relative ("/api/covers/…"); photos from elsewhere are absolute. */
export const assetUrl = (url) => (url && url.startsWith("/api/") ? `${API_URL}${url}` : url);
