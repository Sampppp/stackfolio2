#!/usr/bin/env node
/**
 * One‑off migration script to back‑fill the `hash` field for all existing photo records
 * and delete any duplicates (records that share the same SHA‑256 hash).
 *
 * Usage:
 *   POCKETBASE_URL=http://localhost:8090 node scripts/migrate-hash.js
 */

import PocketBase from 'pocketbase';
import crypto from 'crypto';
import fetch from 'node-fetch';

const PB_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';
const pb = new PocketBase(PB_URL);

function hashBuffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

(async () => {
  const coll = pb.collection('photos');
  console.log('Fetching all photo records…');
  const records = await coll.getFullList({ batch: 200 });

  const seen = new Map(); // hash -> recordId (keeps first occurrence)

  for (const rec of records) {
    // Build the file URL for the stored image
    const fileUrl = pb.files.getUrl(rec, rec.image);
    let buffer;
    try {
      const resp = await fetch(fileUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      buffer = await resp.buffer();
    } catch (e) {
      console.error(`Unable to download image for record ${rec.id}:`, e);
      continue;
    }

    const hash = hashBuffer(buffer);

    // Update the record with its hash if not already set
    if (!rec.hash) {
      try {
        await coll.update(rec.id, { hash });
      } catch (e) {
        console.error(`Failed to set hash for ${rec.id}:`, e);
        continue;
      }
    }

    if (seen.has(hash)) {
      // Duplicate detected – delete the later record
      console.log(`Duplicate found (hash=${hash}). Deleting record ${rec.id}`);
      try {
        await coll.delete(rec.id);
      } catch (e) {
        console.error(`Failed to delete duplicate ${rec.id}:`, e);
      }
    } else {
      seen.set(hash, rec.id);
    }
  }

  console.log('Migration complete.');
  process.exit(0);
})();
