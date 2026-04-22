

# Full System Backup — BlueRiver

Read-only snapshot. No data modified, no migrations run, no deletions.

## Deliverable

A single zip archive at `/mnt/documents/blueriver_backup_<timestamp>.zip` with this structure:

```text
backup/
├── README.md                    ← Manifest + restore instructions
├── VERIFICATION.md              ← Counts + integrity report
├── database/
│   ├── schema.sql               ← Reuse existing bluerivers_schema.sql (24 tables, 6 fns, 76 RLS, indexes, sequences, types)
│   ├── data.sql                 ← INSERT statements for every row in every public table
│   └── data_json/               ← One .json per table (fallback / human-readable)
│       ├── bookings.json
│       ├── quote_requests.json
│       ├── invoices.json
│       └── … (24 files)
├── storage/
│   ├── site-images/             ← Every object downloaded from the site-images bucket
│   │   └── <preserved key paths>
│   └── manifest.json            ← {key, size, content_type, last_modified} per file
├── code/
│   └── source.zip               ← Full project tree (src/, supabase/, public/, configs) excluding node_modules, dist, .git
└── config/
    ├── env.example              ← VITE_* variable names only — values redacted
    ├── supabase_config.toml     ← Copy of supabase/config.toml
    ├── secrets_inventory.txt    ← Names only of the 6 configured secrets (no values)
    ├── storage_buckets.json     ← Bucket name + public flag
    └── business_settings.json   ← Snapshot of site_settings, branding_settings, availability_settings, social_links, condition_settings, page_content
```

## How each part is produced

### 1. Database (`database/`)
- **schema.sql** — copy the existing `/mnt/documents/bluerivers_schema.sql` (already generated, 838 lines, complete).
- **data.sql** — for each of the 24 public tables, run `COPY (SELECT * FROM <table>) TO STDOUT` via `psql` and emit `INSERT INTO public.<table> (...) VALUES (...);` per row. JSONB and arrays preserved with proper escaping.
- **data_json/** — `SELECT json_agg(t) FROM <table> t` per table → pretty-printed JSON. Redundant with `data.sql` but easier to grep/restore selectively.

### 2. Storage (`storage/`)
- List every object in the public `site-images` bucket via the Supabase Storage REST API.
- Download each file (parallel batched) preserving the original key path.
- Write `manifest.json` with full metadata for restore verification.

### 3. Code (`code/`)
- `tar`/`zip` the project tree excluding `node_modules/`, `dist/`, `.git/`, `bun.lockb`, `/tmp` artifacts.
- Includes: `src/`, `supabase/migrations/`, `supabase/functions/`, `public/`, `package.json`, `tsconfig*.json`, `vite.config.ts`, `tailwind.config.ts`, `index.html`, `eslint.config.js`, `.gitignore`, `playwright*.ts`, `vitest.config.ts`, `components.json`.

### 4. Config (`config/`)
- **env.example** — the 3 `VITE_*` variable names from `.env` with placeholder values (the publishable URL/anon key are public anyway, but kept out of the backup to avoid confusion on restore).
- **secrets_inventory.txt** — names of the 6 configured server-side secrets (`LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.). **Values are not exported** — they must be re-set manually in any restored environment.
- **business_settings.json** — convenience extract of CMS-style tables for quick human review.

### 5. Verification (`VERIFICATION.md`)
Auto-generated report containing:
- Table-by-table row counts (24 entries)
- Total rows exported
- Storage file count + total bytes
- Code file count + archive size
- SHA-256 checksums of each top-level file in the zip
- Anything that failed to export (should be none)

## What is **not** in the backup (and why)

| Item | Reason |
|---|---|
| `auth.*`, `storage.*` schema rows | Managed by Supabase platform; not restorable via `psql` outside the platform. Auth users would need to be re-invited on restore. |
| Edge function deployment artifacts | Source code is in `supabase/functions/` (included in code zip); build/deploy is automatic on restore. |
| Secret **values** | Cannot be read back from secret storage. Names listed for re-entry. |
| `node_modules/`, `dist/`, `bun.lockb` | Reproducible from `package.json` + `bun.lock` (text lockfile included). |
| `.git/` history | Out of scope; Lovable manages versioning. |

## Estimated size

- Database data: ~250 KB (largest table is 64 rows in pricing rules)
- Storage: depends on uploaded gallery/branding images — likely 5–50 MB
- Code: ~2–5 MB compressed

## Confirmation of read-only posture

Every step uses `SELECT`, `COPY ... TO STDOUT`, storage `GET`, or filesystem read. **Zero `INSERT`, `UPDATE`, `DELETE`, `ALTER`, or `DROP` issued.** No migrations created. No app behavior changed.

## Final output for the user

A single artifact tag pointing to the zip, plus a short message listing the verification counts and instructions on how to use each section to restore.

