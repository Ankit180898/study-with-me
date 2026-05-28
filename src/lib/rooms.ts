import { BookOpen, Volume2, Sparkles, Coffee, Moon, type LucideIcon } from "lucide-react";

export interface Room {
  id: string;
  name: string;
  vibe: string;
  icon: LucideIcon;
  accent: string;
  /** base value for the mock fallback when Supabase isn't configured */
  base: number;
}

export const ROOMS: Room[] = [
  { id: "deep-work", name: "Deep Work", vibe: "Silent · cameras optional", icon: BookOpen, accent: "var(--chart-1)", base: 64 },
  { id: "lofi-lounge", name: "Lo-fi Lounge", vibe: "Chill beats · low pressure", icon: Volume2, accent: "var(--chart-2)", base: 38 },
  { id: "exam-grind", name: "Exam Grind", vibe: "Pomodoro · accountability", icon: Sparkles, accent: "var(--chart-3)", base: 51 },
  { id: "cafe", name: "Cozy Café", vibe: "Ambient café sounds", icon: Coffee, accent: "var(--chart-4)", base: 27 },
  { id: "night-owls", name: "Night Owls", vibe: "Late-night focus crew", icon: Moon, accent: "var(--chart-5)", base: 19 },
];

export function getRoom(id: string): Room | undefined {
  return ROOMS.find((r) => r.id === id);
}
