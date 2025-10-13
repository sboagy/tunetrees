/**
 * Generate bcrypt hash for test passwords
 *
 * Usage:
 *   tsx scripts/generate-bcrypt-hash.ts "TestPassword123!"
 *
 * This generates bcrypt hashes that you can copy into seed-test-users.sql
 *
 * Prerequisites:
 *   npm install --save-dev bcryptjs @types/bcryptjs
 */

import bcrypt from "bcryptjs";

const password = process.argv[2] || "TestPassword123!";
const saltRounds = 10;

async function generateHash() {
  console.log("🔐 Generating bcrypt hash...\n");
  console.log(`Password: ${password}`);
  console.log(`Salt rounds: ${saltRounds}\n`);

  try {
    const hash = await bcrypt.hash(password, saltRounds);

    console.log("✅ Generated hash:");
    console.log(hash);
    console.log("\n📋 Copy this hash into your SQL file:");
    console.log(`encrypted_password: '${hash}'`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

generateHash();
