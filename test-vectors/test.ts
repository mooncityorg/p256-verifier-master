import fs from "fs";
import crypto from "crypto";

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
    const x = Buffer.from(vector.x, "hex");
    const y = Buffer.from(vector.y, "hex");
    const r = Buffer.from(vector.r, "hex");
    const s = Buffer.from(vector.s, "hex");
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
        x: Buffer.from(vector.x, "hex").toString("base64url"),
        y: Buffer.from(vector.y, "hex").toString("base64url"),
      },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const sig = new Uint8Array([...r, ...s]);
    const result = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      sig,
      msg
    );

    // Check result
    assert(result === vector.valid, vector.comment);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

main()
  .then(() => console.log("Done"))
  .catch(console.error);