# Chess Puzzle — Mutations Reference

> **Scope:** These mutations are **not** part of the `PuzzleModule`.  
> CSV importing and Lichess sync are handled by a separate pipeline service.  
> This document records their interfaces so they can be wired in later.

---

## Import Mutations

### `importChessPuzzlesCsv`

Stream-read a Lichess CSV file and insert rows with batched `INSERT … ON CONFLICT DO NOTHING`.

```graphql
mutation ImportCsv($filePath: String!) {
  importChessPuzzlesCsv(filePath: $filePath) {
    imported
    skipped
    durationMs
    error
  }
}
```

| Argument   | Type     | Description                               |
|------------|----------|-------------------------------------------|
| `filePath` | `String` | Absolute server-side path to the CSV file |

**Returns:** `ImportResult`

| Field        | Type      | Description                           |
|--------------|-----------|---------------------------------------|
| `imported`   | `Int`     | Number of rows inserted               |
| `skipped`    | `Int`     | Rows skipped (already existed)        |
| `durationMs` | `Int`     | Wall-clock time of the import         |
| `error`      | `String?` | Non-null if the import failed         |

---

### `importChessPuzzlesCsvFast`

Uses **PostgreSQL `COPY FROM`** — ~3× faster than batched INSERTs.  
Requires the `pg-copy-streams` package.

```graphql
mutation ImportCsvFast($filePath: String!) {
  importChessPuzzlesCsvFast(filePath: $filePath) {
    imported
    skipped
    durationMs
    error
  }
}
```

Same arguments and return type as `importChessPuzzlesCsv`.

---

## Sync Mutations (Lichess Monthly Pipeline)

### `syncChessPuzzles`

Manually trigger the Lichess monthly sync pipeline.  
Downloads `lichess_db_puzzle.csv.zst`, decompresses it, and upserts into the DB.  
Reuses a cached `.zst` if it was already downloaded this month.  
The pipeline runs **in the background** — poll `syncChessPuzzlesStatus` for progress.

> A cron job also fires automatically at **02:00 UTC on the 1st of every month**.

```graphql
mutation {
  syncChessPuzzles
}
```

**Returns:** `String` — a human-readable status message (e.g. `"Sync started"`).

---

### `syncChessPuzzlesForce`

Force re-download even if this month's `.zst` is already cached.  
Use when Lichess pushes a mid-month dataset correction.

```graphql
mutation {
  syncChessPuzzlesForce
}
```

**Returns:** `String` — status message.

---

## Sync Status Query

### `syncChessPuzzlesStatus`

Poll the current state of the background sync pipeline.

```graphql
query {
  syncChessPuzzlesStatus {
    phase
    downloadedBytes
    totalBytes
    importedRows
    errorMessage
    startedAt
    finishedAt
  }
}
```

**Returns:** `SyncStatus`

| Field             | Type       | Description                                                                 |
|-------------------|------------|-----------------------------------------------------------------------------|
| `phase`           | `String`   | `idle` \| `downloading` \| `decompressing` \| `importing` \| `cleaning_up` \| `done` \| `failed` |
| `downloadedBytes` | `Int`      | Bytes downloaded so far                                                     |
| `totalBytes`      | `Int`      | Total expected bytes (0 if unknown)                                         |
| `importedRows`    | `Int`      | Rows upserted so far                                                        |
| `errorMessage`    | `String?`  | Non-null if `phase === "failed"`                                             |
| `startedAt`       | `String?`  | ISO-8601 timestamp when the sync began                                      |
| `finishedAt`      | `String?`  | ISO-8601 timestamp when the sync ended                                      |

---

## Import Progress Query

### `chessPuzzleImportProgress`

Poll the current row count while a CSV import is running.

```graphql
query {
  chessPuzzleImportProgress
}
```

**Returns:** `Int` — number of rows committed so far.
