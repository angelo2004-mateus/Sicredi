import { useState } from "react";
import { Icon } from "./Icon.jsx";

export function ThemeToggle() {
  const [dark, setDark] = useState(
    () => document.documentElement.dataset.theme === "dark",
  );

  function toggleTheme() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("sicredi-theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={dark ? "Modo claro" : "Modo escuro"}
      title={dark ? "Modo claro" : "Modo escuro"}
      onClick={toggleTheme}
    >
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}
