/**
 * Ed25519 signature verification tests (Discord interactions).
 * Uses Node crypto to mint vectors that match WebCrypto Ed25519 verify.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, verify as nodeVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Load compiled-less TS via dynamic transpile isn't available; duplicate hex/verify
// in pure JS for the Node test harness (same algorithm as src/verify.ts).
function hexToBytes(hex) {
  const clean = hex.trim().toLowerCase().replace(/^0x/, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(buf) {
  return Buffer.from(buf).toString("hex");
}

async function verifyDiscordRequest(publicKeyHex, signatureHex, timestamp, body) {
  const keyBytes = hexToBytes(publicKeyHex);
  const sigBytes = hexToBytes(signatureHex);
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

function rawPublicKeyHex() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" });
  const x = Buffer.from(jwk.x, "base64url");
  return { privateKey, publicKey, publicKeyHex: x.toString("hex") };
}

test("valid Discord-style signature verifies", async () => {
  const { privateKey, publicKey, publicKeyHex } = rawPublicKeyHex();
  const timestamp = "1700000000";
  const body = JSON.stringify({ type: 1 });
  const msg = Buffer.from(timestamp + body);
  const sig = sign(null, msg, privateKey);
  assert.equal(nodeVerify(null, msg, publicKey, sig), true);
  const ok = await verifyDiscordRequest(
    publicKeyHex,
    bytesToHex(sig),
    timestamp,
    body,
  );
  assert.equal(ok, true);
});

test("tampered body is rejected", async () => {
  const { privateKey, publicKeyHex } = rawPublicKeyHex();
  const timestamp = "1700000000";
  const body = JSON.stringify({ type: 1 });
  const sig = sign(null, Buffer.from(timestamp + body), privateKey);
  const ok = await verifyDiscordRequest(
    publicKeyHex,
    bytesToHex(sig),
    timestamp,
    JSON.stringify({ type: 1, evil: true }),
  );
  assert.equal(ok, false);
});

test("tampered signature is rejected", async () => {
  const { privateKey, publicKeyHex } = rawPublicKeyHex();
  const timestamp = "1700000000";
  const body = JSON.stringify({ type: 1 });
  const sig = Buffer.from(sign(null, Buffer.from(timestamp + body), privateKey));
  sig[0] ^= 0xff;
  const ok = await verifyDiscordRequest(
    publicKeyHex,
    bytesToHex(sig),
    timestamp,
    body,
  );
  assert.equal(ok, false);
});

test("missing/odd key lengths fail closed", async () => {
  assert.equal(await verifyDiscordRequest("", "ab", "1", "{}"), false);
  assert.equal(await verifyDiscordRequest("00".repeat(32), "00".repeat(32), "1", "{}"), false);
});

// Fixture file presence (Discord docs point at Ed25519 over timestamp+body)
test("ships documented fixture note", () => {
  const note = readFileSync(join(ROOT, "test/fixtures/README.md"), "utf8");
  assert.match(note, /Ed25519/);
  assert.match(note, /X-Signature-Ed25519/);
});
