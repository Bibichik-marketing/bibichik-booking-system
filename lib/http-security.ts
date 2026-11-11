import { createHmac, randomBytes } from "node:crypto";
import { setting } from "./runtime-env";
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && (origin === new URL(request.url).origin || origin === setting("SITE_URL")));
}
export async function readJson(request: Request, maximum = 24000): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Expected JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.length;
    if (size > maximum) { await reader.cancel(); throw new Error("Request too large."); }
    chunks.push(part.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
const salt = randomBytes(32);
const limits = new Map<string, {count:number; expires:number}>();
export function allowSubmission(request: Request) {
  const now = Date.now();
  for (const [key,item] of limits) if(item.expires <= now) limits.delete(key);
  const header = setting("TRUSTED_CLIENT_IP_HEADER");
  const address = header ? request.headers.get(header)?.split(",")[0].trim() || "unknown" : "shared";
  const key = createHmac("sha256",salt).update(address).digest("hex");
  const entry = limits.get(key) || {count:0,expires:now+60000};
  if (!limits.has(key) && limits.size >= 1000) return false;
  entry.count++;
  limits.set(key,entry);
  return entry.count <= (header ? 5 : 30);
}
