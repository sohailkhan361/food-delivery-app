"use client";

import { useTheme } from "@/lib/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const ORDER = ["light", "dark", "system"] as const;
const LABEL = { light: "Light", dark: "Dark", system: "System" } as const;
const ICON = { light: SunIcon, dark: MoonIcon, system: MonitorIcon } as const;

/** Cycles light -> dark -> system. Persisted by next-themes in localStorage. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = theme;
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = ICON[current];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABEL[current]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[current]}`}
    >
      <Icon />
    </Button>
  );
}
