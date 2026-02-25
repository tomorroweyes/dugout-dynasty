import { Button } from "@/components/ui/8bit/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getLabel = () => {
    if (theme === "dark") return "🌙 Dark";
    if (theme === "light") return "☀️ Light";
    return "💻 System";
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
    >
      {getLabel()}
    </Button>
  );
}
