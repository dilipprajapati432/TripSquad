// One place that maps app concepts to icons, so the whole UI uses a single, consistent icon set.
import {
  Utensils, BedDouble, Car, Ticket, ShoppingBag, Receipt,
  Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning,
  UserPlus, Pencil, Wallet, Handshake, Trash2, Vote, Trophy, MapPin, Sparkles, LogOut, Bell,
  CircleCheck, TriangleAlert, Info, ImageIcon,
} from "lucide-react";

export const CATEGORY_ICONS = {
  food: Utensils,
  stay: BedDouble,
  transport: Car,
  activity: Ticket,
  shopping: ShoppingBag,
  other: Receipt,
};

export const CATEGORY_LABELS = {
  food: "Food",
  stay: "Stay",
  transport: "Transport",
  activity: "Activities",
  shopping: "Shopping",
  other: "Other",
};

/** Tint class per category (see .tint-* in styles.css) so each kind of spending is easy to spot. */
export const CATEGORY_TINTS = {
  food: "tint-orange",
  stay: "tint-violet",
  transport: "tint-blue",
  activity: "tint-pink",
  shopping: "tint-teal",
  other: "tint-gray",
};

/** Icon for trip activity (toasts + automatic chat messages). Keys come from the server. */
export const ACTIVITY_ICONS = {
  join: UserPlus,
  edit: Pencil,
  expense: Wallet,
  settle: Handshake,
  delete: Trash2,
  poll: Vote,
  result: Trophy,
  place: MapPin,
  ai: Sparkles,
  leave: LogOut,
  location: MapPin,
  info: Bell,
  cover: ImageIcon,
};

export const TOAST_ICONS = { success: CircleCheck, error: TriangleAlert, info: Info };

/** WMO weather code (Open-Meteo) -> icon + label */
export function weatherIcon(code) {
  if (code === 0) return { Icon: Sun, label: "Clear" };
  if (code <= 2) return { Icon: CloudSun, label: "Partly cloudy" };
  if (code === 3) return { Icon: Cloud, label: "Cloudy" };
  if (code <= 48) return { Icon: CloudFog, label: "Fog" };
  if (code <= 57) return { Icon: CloudDrizzle, label: "Drizzle" };
  if (code <= 67 || (code >= 80 && code <= 82)) return { Icon: CloudRain, label: "Rain" };
  if (code <= 77 || (code >= 85 && code <= 86)) return { Icon: CloudSnow, label: "Snow" };
  return { Icon: CloudLightning, label: "Thunderstorm" };
}

// Older chat messages were saved with an emoji in front of the text; strip it when displaying.
export const stripLeadingEmoji = (s = "") => s.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, "");
