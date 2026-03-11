import { useEffect, useState } from "react";
import { Clock, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Alba", icon: Sun },
  { value: "dark", label: "Tramonto", icon: Moon },
  { value: "system", label: "Naturale", icon: Clock },
] as const;

type ThemeValue = (typeof THEME_OPTIONS)[number]["value"];

interface ThemeSelectorProps {
  className?: string;
  inverted?: boolean;
}

const ThemeSelector = ({ className, inverted = false }: ThemeSelectorProps) => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme: ThemeValue =
    mounted && (theme === "light" || theme === "dark" || theme === "system")
      ? theme
      : "system";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border p-1 shadow-lg backdrop-blur-xl",
        inverted
          ? "border-white/15 bg-black/35 text-white"
          : "border-border/70 bg-background/85 text-foreground",
        className,
      )}
    >
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = activeTheme === value;

        return (
          <button
            key={value}
            type="button"
            aria-label={`Attiva tema ${label.toLowerCase()}`}
            aria-pressed={isActive}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
              inverted
                ? isActive
                  ? "bg-white text-[#08262a] shadow-md"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
                : isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            onClick={() => setTheme(value)}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ThemeSelector;
