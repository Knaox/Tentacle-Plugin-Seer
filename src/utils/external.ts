/**
 * Comportements plateforme — réplique STRICTE du core web :
 * apps/web/src/components/detail/youtube.ts + apps/web/src/lib/openExternal.ts
 *
 * Le plugin tourne dans une iframe sandboxée (allow-scripts seul) : pas d'accès
 * à __TAURI_INTERNALS__ ni à window.open. Le host injecte `window.__tentacle_env`
 * (plateforme + base backend) et expose `__tentacle_bridge.openExternal`.
 */

interface TentacleHostEnv {
  tauri?: boolean;
  mac?: boolean;
  prod?: boolean;
  backendUrl?: string;
}

function hostEnv(): TentacleHostEnv {
  return ((window as unknown as Record<string, unknown>).__tentacle_env as TentacleHostEnv) ?? {};
}

/**
 * DMG macOS : WKWebView strip le Referer pour les iframes sous frame racine
 * tauri:// → YouTube refuse l'embed (erreur 153). Comme le core, on ouvre
 * directement la bande-annonce dans le navigateur système.
 */
export function shouldOpenYouTubeExternally(): boolean {
  const env = hostEnv();
  return !!(env.tauri && env.mac && env.prod);
}

/**
 * Source de l'iframe d'embed pour `youtubeId` — même logique que le core :
 * macOS Tauri (dev) passe par la page relais `/yt-embed.html` du backend
 * (origine HTTP valide), ailleurs embed `youtube-nocookie` direct.
 */
export function youtubeEmbedSrc(youtubeId: string): string {
  const direct = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=1`;
  const env = hostEnv();
  if (env.tauri && env.mac) {
    const backend = (env.backendUrl ?? "").replace(/\/$/, "");
    if (backend) return `${backend}/yt-embed.html?v=${youtubeId}`;
  }
  return direct;
}

/** Ouvre une URL dans le navigateur système via le bridge host (repli window.open). */
export function openExternal(url: string): void {
  if (!url) return;
  const bridge = (window as unknown as Record<string, unknown>).__tentacle_bridge as
    { openExternal?: (url: string) => void } | undefined;
  if (bridge?.openExternal) {
    bridge.openExternal(url);
    return;
  }
  // Mobile WebView / contexte hors iframe : postMessage RN ou window.open.
  const rnWebView = (window as unknown as Record<string, unknown>).ReactNativeWebView as
    { postMessage?: (msg: string) => void } | undefined;
  if (rnWebView?.postMessage) {
    rnWebView.postMessage(JSON.stringify({ type: "OPEN_EXTERNAL", url }));
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Handler de clic prêt à l'emploi pour un lien externe (preventDefault + openExternal). */
export function externalLinkHandler(url: string) {
  return (e: { preventDefault: () => void }) => {
    e.preventDefault();
    openExternal(url);
  };
}

/**
 * Joue les bandes-annonces via le TrailerModal du HOST quand le bridge le
 * permet. Un embed YouTube imbriqué dans l'iframe sandboxée du plugin hérite
 * de la sandbox (pas d'allow-same-origin) → le player YouTube plante
 * (SecurityError caches / writeEmbed). Retourne false si le bridge est absent
 * (mobile WebView) — l'appelant retombe sur la modale locale.
 */
export function openTrailersViaHost(
  trailers: Array<{ Url: string; Name?: string }>,
  index = 0,
): boolean {
  const bridge = (window as unknown as Record<string, unknown>).__tentacle_bridge as
    { openTrailer?: (trailers: Array<{ Url: string; Name?: string }>, index: number) => void } | undefined;
  if (!bridge?.openTrailer || trailers.length === 0) return false;
  bridge.openTrailer(trailers.map((t) => ({ Url: t.Url, Name: t.Name })), index);
  return true;
}
