/* ------------------------------------------------------------------ */
/*  Détection du schéma (clair/sombre) du host, toutes plateformes.   */
/*                                                                     */
/*  Ordre de détection :                                               */
/*    1. `data-theme` sur <html> — iframe web/desktop (le host stampe  */
/*       le srcdoc avec son thème courant) ;                           */
/*    2. `color-scheme` résolu — template WebView mobile récent        */
/*       (pluginThemeTokens y écrit `color-scheme:<scheme>`) ;         */
/*    3. luminance de `--surface-0` (ou l'alias `--bg` des anciens     */
/*       templates mobiles) : > 0.5 → clair ;                          */
/*    4. défaut : sombre.                                              */
/* ------------------------------------------------------------------ */

export type HostScheme = "light" | "dark";

/** Luminance relative (0-1) d'une couleur CSS `#RGB`/`#RRGGBB`/`rgb(a)()` — null si non parsable. */
function relativeLuminance(color: string): number | null {
  let r: number, g: number, b: number;
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  const rgb = color.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else if (rgb) {
    r = Number(rgb[1]);
    g = Number(rgb[2]);
    b = Number(rgb[3]);
  } else {
    return null;
  }
  // Approximation perceptuelle suffisante pour trancher clair/sombre.
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function detectHostScheme(): HostScheme {
  try {
    const root = document.documentElement;
    const dataTheme = root.getAttribute("data-theme");
    if (dataTheme === "light") return "light";
    if (dataTheme === "dark") return "dark";

    const cs = getComputedStyle(root);
    const colorScheme = cs.colorScheme || "";
    const saysLight = /\blight\b/.test(colorScheme);
    const saysDark = /\bdark\b/.test(colorScheme);
    if (saysLight && !saysDark) return "light";
    if (saysDark && !saysLight) return "dark";

    const surface =
      cs.getPropertyValue("--surface-0").trim() || cs.getPropertyValue("--bg").trim();
    if (surface) {
      const lum = relativeLuminance(surface);
      if (lum != null) return lum > 0.5 ? "light" : "dark";
    }
  } catch {
    /* défaut sombre */
  }
  return "dark";
}

/**
 * Observe une bascule de thème du host (attribut `data-theme` du root) et
 * rappelle `cb` avec le nouveau schéma. No-op silencieux si l'environnement
 * ne le permet pas. Retourne une fonction de nettoyage.
 */
export function watchHostScheme(cb: (scheme: HostScheme) => void): () => void {
  try {
    const observer = new MutationObserver(() => cb(detectHostScheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  } catch {
    return () => {};
  }
}
