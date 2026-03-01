/* ------------------------------------------------------------------ */
/*  Seer API — proxy helper + config management                       */
/* ------------------------------------------------------------------ */

let _backendBase = "";
let _seerrUrl = "";
let _seerrApiKey = "";

export function setSeerBackendUrl(url: string) {
  _backendBase = url.replace(/\/$/, "");
}

export function getSeerBackendUrl(): string {
  return _backendBase;
}

export function setSeerrConfig(url: string, apiKey: string) {
  _seerrUrl = url.replace(/\/$/, "");
  _seerrApiKey = apiKey;
}

export function getSeerrUrl(): string {
  return _seerrUrl;
}

function getToken(): string {
  return localStorage.getItem("tentacle_token") ?? "";
}

/**
 * Route all Seerr API calls through the generic Tentacle plugin proxy.
 * POST /api/plugins/seer/proxy → backend fetches Seerr on our behalf (no CORS).
 */
export async function proxyFetch<T>(
  seerrPath: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${_backendBase}/api/plugins/seer/proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      url: `${_seerrUrl}${seerrPath}`,
      method: options?.method ?? "GET",
      headers: {
        "X-Api-Key": _seerrApiKey,
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options?.body,
    }),
  });
  const proxy = await res.json();
  if (!res.ok || !proxy.ok) {
    throw new Error(`Seerr API error: ${proxy.status || res.status}`);
  }
  return proxy.data as T;
}

/** Direct call to the Tentacle plugin config endpoint (not proxied to Seerr) */
export function configUrl(): string {
  return `${_backendBase}/api/plugins/seer/config`;
}
