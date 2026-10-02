// Browser notifications for new chat messages when the tab isn't visible.
const KEY = "tripsquad_notify";

export const notifySupported = () => typeof window !== "undefined" && "Notification" in window;

export function notifyEnabled() {
  if (!notifySupported() || Notification.permission !== "granted") return false;
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export async function enableNotifications() {
  if (!notifySupported()) return false;
  const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  try {
    localStorage.setItem(KEY, result === "granted" ? "on" : "off");
  } catch {
    /* storage blocked */
  }
  return result === "granted";
}

export function disableNotifications() {
  try {
    localStorage.setItem(KEY, "off");
  } catch {
    /* storage blocked */
  }
}

export function showNotification(title, body, onClick) {
  if (!notifyEnabled() || document.visibilityState === "visible") return;
  try {
    const n = new Notification(title, { body, icon: "/favicon.svg", tag: title });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}
