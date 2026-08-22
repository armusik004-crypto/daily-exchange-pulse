// When the app is packaged as an Android APK (Capacitor/WebView) it is served
// from a local origin (file:// or https://localhost), so relative "/api/..."
// URLs would hit nothing. In that build we point API calls at the deployed
// site instead. In the normal web build we keep relative URLs.
const REMOTE_ORIGIN = "https://daily-exchange-pulse.lovable.app";

export const IS_PACKAGED_APP =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_APK_BUILD === "1";

export function apiUrl(path: string): string {
  return IS_PACKAGED_APP ? `${REMOTE_ORIGIN}${path}` : path;
}
