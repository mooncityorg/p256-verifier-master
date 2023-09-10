import fs from "fs";
import crypto from "crypto";
import { p256 } from "@noble/curves/p256";

interface Vector {
  x: string;
  y: string;
  r: string;
  s: string;
  hash: string;
  valid: boolean;
  msg: string;
  comment: string;
}

// Validate generated vectors using the known-good SubtleCrypto P256 verifier.
// We then use the vectors to test other implementations like P256Verifier.sol
async function main() {
  const vectorsJSONL = fs.readFileSync("../test/vectors.jsonl", "utf8");
  const vectors = vectorsJSONL
    .split("\n")
    .map((line) => JSON.parse(line) as Vector);

  for (const vector of vectors) {
    // Convert hex strings to Uint8Arrays
    const x = Buffer.from(vector.x.padStart(64, "0"), "hex");
    const y = Buffer.from(vector.y.padStart(64, "0"), "hex");
    const r = Buffer.from(vector.r.padStart(64, "0"), "hex");
    const s = Buffer.from(vector.s.padStart(64, "0"), "hex");
    const msg = Buffer.from(vector.msg, "hex");
    const hash = Buffer.from(vector.hash, "hex");

    // Validate SHA-256 hash
    const msgHash = Buffer.from(await crypto.subtle.digest("SHA-256", msg));
    assert(msgHash.equals(hash), vector.comment);

    // Verify signature using SubtleCrypto
    const key = await crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        x: x.toString("base64url"),
        y: y.toString("base64url"),
      },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const sig = new Uint8Array([...r, ...s]);
    const resultSubtle = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      sig,
      msg
    );
    assert(resultSubtle === vector.valid, "SubtleCrypto " + vector.comment);

    // Verify signature using @noble/curves
    const pub = new Uint8Array([0x04, ...x, ...y]);
    const resultNoble = p256.verify(sig, hash, pub);
    if (resultNoble !== vector.valid) {
      console.log(
        `@noble/curves returned ${resultNoble}, expected ${vector.valid} for ${vector.comment}`
      );
    }
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

main()
  .then(() => console.log("Done"))
  .catch(console.error);
