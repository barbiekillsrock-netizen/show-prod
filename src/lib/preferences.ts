// Preferências do usuário persistidas no localStorage

const KEY_DARK_MODE = "showprod:pref:darkMode";

export function getDarkModePreference(): boolean {
  if (typeof window === "undefined") return true; // padrão: ligado
  try {
    const val = window.localStorage.getItem(KEY_DARK_MODE);
    if (val === null) return true; // padrão: ligado
    return val === "true";
  } catch {
    return true;
  }
}

export function setDarkModePreference(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_DARK_MODE, String(value));
  } catch {}
}
