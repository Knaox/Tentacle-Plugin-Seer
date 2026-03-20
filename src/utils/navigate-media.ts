/**
 * Navigue vers la page media Tentacle pour un item disponible.
 * Résout TMDB ID → Jellyfin ID via /api/tmdb/resolve.
 */
export async function navigateToMedia(tmdbId: number, mediaType: string): Promise<void> {
  const isMobile = !!(window as any).ReactNativeWebView?.postMessage;
  const path = `/api/tmdb/resolve?tmdbId=${tmdbId}&mediaType=${mediaType}`;

  try {
    let jellyfinId: string | null = null;
    if (isMobile) {
      // Mobile : URL complète (le chemin relatif ne fonctionne pas dans WebView)
      const backendUrl = localStorage.getItem("tentacle_server_url") ?? "";
      const token = localStorage.getItem("tentacle_token") ?? "";
      if (!backendUrl || !token) return;
      const res = await fetch(`${backendUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      jellyfinId = data.jellyfinId;
    } else {
      // Web : fetch relatif intercepté par le bridge iframe (auth auto)
      const res = await fetch(path);
      if (!res.ok) return;
      const data = await res.json();
      jellyfinId = data.jellyfinId;
    }

    if (!jellyfinId) return;
    const route = `/media/${jellyfinId}`;

    if (isMobile) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "NAVIGATE", route }));
    } else if ((window as any).__tentacle_bridge?.navigate) {
      (window as any).__tentacle_bridge.navigate(route);
    } else {
      window.parent.postMessage({ type: "NAVIGATE", path: route }, "*");
    }
  } catch {
    // silent
  }
}
