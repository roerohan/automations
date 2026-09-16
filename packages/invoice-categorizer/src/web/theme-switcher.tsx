import { useEffect, useState } from "react";
import { Button } from "@cloudflare/kumo";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";

type Theme = "light" | "dark" | "system";
const storageKey = "invoice-categorizer-theme";
const choices = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Desktop },
] as const;

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // Appearance still works when browser storage is unavailable.
    }
    return "system";
  });
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.mode =
        theme === "system" ? (system.matches ? "dark" : "light") : theme;
    };
    apply();
    system.addEventListener("change", apply);
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // Do not block changing the theme in private or restricted browsers.
    }
    return () => system.removeEventListener("change", apply);
  }, [theme]);
  return (
    <div className="theme-switcher" role="group" aria-label="Appearance">
      {choices.map(({ value, label, Icon }) => (
        <Button
          key={value}
          size="sm"
          aria-label={`${label} theme`}
          aria-pressed={theme === value}
          title={`${label} theme`}
          onClick={() => setTheme(value)}
        >
          <Icon size={16} aria-hidden="true" />
          <span className="theme-label">{label}</span>
        </Button>
      ))}
    </div>
  );
}
