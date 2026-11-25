"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const ORDER = ["light", "dark", "system"] as const;
const LABEL = { light: "Light", dark: "Dark", system: "System" } as const;
const ICON = { light: SunIcon, dark: MoonIcon, system: MonitorIcon } as const;

const subscribe = () => () => {};

/** Cycles light -> dark -> system. Persisted by next-themes in localStorage. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The stored theme is unknown on the server; render a neutral icon until mounted.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const current = mounted && theme && theme in ICON ? (theme as keyof typeof ICON) : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = mounted ? ICON[current] : MonitorIcon;

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
