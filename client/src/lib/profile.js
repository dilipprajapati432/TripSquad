// How complete is someone's travel profile? Used by the dashboard card and the setup wizard.
export const PROFILE_ITEMS = [
  { key: "avatar", label: "Photo", weight: 15, done: (u) => Boolean(u.avatarThumb || u.avatar) },
  { key: "homeCity", label: "Home city", weight: 10, done: (u) => Boolean(u.homeCity) },
  { key: "languages", label: "Languages", weight: 10, done: (u) => (u.languages || []).length > 0 },
  { key: "phone", label: "Phone", weight: 20, done: (u) => Boolean(u.phone) },
  { key: "emergency", label: "Emergency contact", weight: 25, done: (u) => Boolean(u.emergencyName && u.emergencyPhone) },
  { key: "food", label: "Food preference", weight: 10, done: (u) => Boolean(u.food) },
  { key: "paymentInfo", label: "How to pay you", weight: 10, done: (u) => Boolean(u.paymentInfo) },
];

export function profileCompleteness(user) {
  if (!user) return { percent: 0, missing: PROFILE_ITEMS };
  const missing = PROFILE_ITEMS.filter((i) => !i.done(user));
  const percent = 100 - missing.reduce((n, i) => n + i.weight, 0);
  return { percent, missing };
}

export const FOOD_LABELS = {
  vegetarian: "Vegetarian",
  "non-vegetarian": "Non-vegetarian",
  vegan: "Vegan",
  jain: "Jain",
  eggetarian: "Eggetarian",
  halal: "Halal",
  "no preference": "No preference",
};

export const PHONE_RE = /^[+0-9 ()-]{6,25}$/;
