/**
 * Generate bcrypt hash for test passwords
 *
 * Usage:
 *   tsx scripts/generate-bcrypt-hash.ts "$(op read 'op://rhizome/shared-local/Test/ALICE_TEST_PASSWORD')"
 *
 * This generates bcrypt hashes that you can copy into seed-test-users.sql
 *
 * Prerequisites:
 *   npm install --save-dev bcryptjs @types/bcryptjs
 */

import bcrypt from "bcryptjs";

const password = process.argv[2];
const saltRounds = 10;

async function generateHash() {
  if (!password) {
    console.error(
      "Usage: tsx scripts/generate-bcrypt-hash.ts \"$(op read 'op://rhizome/shared-local/Test/ALICE_TEST_PASSWORD')\""
    );
    process.exit(1);
  }

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
