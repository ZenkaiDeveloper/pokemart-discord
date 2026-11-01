/**
 * Discord HTTP interactions Ed25519 signature verification (WebCrypto).
 * Spec: https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization
 */
import { hexToBytes } from "./util";

export async function verifyDiscordRequest(
  publicKeyHex: string,
  signatureHex: string,
  timestamp: string,
  body: string,
): Promise<boolean> {
  if (!publicKeyHex || !signatureHex || !timestamp) return false;
  let keyBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    keyBytes = hexToBytes(publicKeyHex);
    sigBytes = hexToBytes(signatureHex);
  } catch {
    return false;
  }
  if (keyBytes.length !== 32 || sigBytes.length !== 64) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const message = new TextEncoder().encode(timestamp + body);
  try {
    return await crypto.subtle.verify("Ed25519", key, sigBytes, message);
  } catch {
    return false;
  }
}
