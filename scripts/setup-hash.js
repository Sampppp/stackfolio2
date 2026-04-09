#!/usr/bin/env node
/**
 * Ensure the `photos` collection has a `hash` field (text, required, unique) and
 * back‑fill it for all existing records. This script runs against a running PocketBase
 * instance and does not rely on the migration system, avoiding the schema API mismatch.
 */

// Dynamically import ESM modules to keep this script runnable with Node's CommonJS mode
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

(async () => {
  const { default: PocketBase } = await import('pocketbase');
  const PB_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';
  const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'a@gmail.com';
  const ADMIN_PASS = process.env.PB_ADMIN_PASS || '1234567890';
  const pb = new PocketBase(PB_URL);

  async function ensureHashField() {
  // Authenticate as admin
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);

  // Fetch current collection definition
  const col = await pb.collections.getOne('photos');
  const hasHash = col.schema?.some((f) => f.name === 'hash') || col.fields?.some((f) => f.name === 'hash');

  if (!hasHash) {
    // Add the field definition
    const newField = {
      name: 'hash',
      type: 'text',
      required: true,
      unique: true,
      options: { maxLength: 64 },
    };

    // PocketBase v0.23 uses `fields` array
    const updated = await pb.collections.update('photos', {
      fields: [...(col.fields || []), newField],
    });
    console.log('Added hash field to collection');
    // Ensure a unique index exists for the hash field (PocketBase may require explicit index creation)
    try {
      await pb.collections.update('photos', {
        indexes: [{ type: 'hash', fields: ['hash'], unique: true }],
      });
      console.log('Created unique index on hash');
    } catch (e) {
      console.warn('Index creation failed (may already exist):', e.message);
    }
    return updated;
  }
  console.log('Hash field already exists');
  return col;
}

async function backfillHashes() {
  const records = await pb.collection('photos').getFullList({ batch: 200 });
  const seen = new Map();
  for (const rec of records) {
    // Download file to compute hash
    const fileUrl = pb.files.getURL(rec, rec.image);
    const resp = await fetch(fileUrl);
    if (!resp.ok) continue;
    const buffer = await resp.buffer();
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Update record with hash if missing
    if (!rec.hash) {
      await pb.collection('photos').update(rec.id, { hash });
    }

    // Detect duplicate hashes and delete later ones
    if (seen.has(hash)) {
      console.log(`Duplicate detected, deleting record ${rec.id}`);
      await pb.collection('photos').delete(rec.id);
    } else {
      seen.set(hash, rec.id);
    }
  }
  console.log('Backfill complete');
}

  // Execute the migration steps
  try {
    await ensureHashField();
    await backfillHashes();
    process.exit(0);
  } catch (e) {
    console.error('Setup failed:', e);
    process.exit(1);
  }
})();
