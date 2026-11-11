export function setting(key: string): string {
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
}
export function safeHttpsUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}

