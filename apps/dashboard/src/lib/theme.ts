export type ThemeChoice = "light" | "dark" | "system";

const STORE_KEY = "warera-verify.theme";

export function getStoredTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch { /* storage denied */ }
  return "system";
}

export function setStoredTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(STORE_KEY);
    else localStorage.setItem(STORE_KEY, choice);
  } catch { /* ignore */ }
}

export function applyTheme(choice: ThemeChoice) {
  const useDark = resolveDark(choice);
  document.documentElement.classList.toggle("dark", useDark);
}

function resolveDark(choice: ThemeChoice): boolean {
  if (choice === "dark") return true;
  if (choice === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
