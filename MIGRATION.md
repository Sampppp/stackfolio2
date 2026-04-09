# Migration Commands for Image‑Hash Deduplication

The following are the exact commands you need to run, **including the directory** you should be in when executing each one.

## 1 Re‑build the backend container
```bash
# From the project root (/home/spak/stackfolio2)
docker compose up -d --build backend
```

## 2 Verify PocketBase health
```bash
curl -s http://localhost:8090/api/health
```
You should see a JSON response with `"code":200`.

## 3 Install migration script dependencies (if not already installed)
```bash
# From the project root
npm install pocketbase node-fetch
```

## 4 Run the migration script to add the `hash` field, back‑fill hashes and delete duplicates
```bash
# From the project root
node scripts/setup-hash.js
```
Expected output (example):
```
Added hash field to collection
Duplicate detected, deleting record <id>
Backfill complete
```