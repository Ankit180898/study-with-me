const PALETTE = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#d946ef",
];

export function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "G";
  const parts = trimmed.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Friendly fallback name derived from a user id, e.g. "Owl 4f9a". */
export function guestName(id: string): string {
  const animals = ["Owl", "Fox", "Cat", "Bee", "Elk", "Jay", "Koi", "Yak", "Ram", "Doe"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `${animals[h % animals.length]} ${id.slice(0, 4)}`;
}
