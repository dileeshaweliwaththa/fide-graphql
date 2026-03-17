# Chess Puzzle — GraphQL Playground Reference

> Base URL: **`http://localhost:5100/graphql`**  
> All queries below are **copy-paste ready** — no variables panel needed.

---

## 1. `chessPuzzles` — Paginated list (no filters)

```graphql
query {
  chessPuzzles(filter: { limit: 20 }) {
    items {
      puzzle_id
      fen
      moves
      rating
      rating_deviation
      popularity
      nb_plays
      themes
      opening_tags
      game_url
    }
    hasNextPage
    nextCursor
  }
}
```

---

## 2. `chessPuzzles` — Filtered by rating + theme

```graphql
query {
  chessPuzzles(filter: {
    minRating: 1200
    maxRating: 1600
    themes: ["fork"]
    limit: 10
    sortBy: rating
    sortOrder: ASC
  }) {
    items {
      puzzle_id
      fen
      moves
      rating
      themes
    }
    hasNextPage
    nextCursor
  }
}
```

---

## 3. `chessPuzzles` — Next page (paste real `nextCursor` value)

```graphql
query {
  chessPuzzles(filter: {
    minRating: 1200
    maxRating: 1600
    themes: ["fork"]
    limit: 10
    cursor: "REPLACE_WITH_nextCursor_VALUE"
  }) {
    items {
      puzzle_id
      fen
      moves
      rating
      themes
    }
    hasNextPage
    nextCursor
  }
}
```

> `sortBy` options: `rating` · `popularity` · `nb_plays`  
> `sortOrder` options: `ASC` · `DESC`

---

## 4. `chessPuzzle` — Single puzzle by ID

```graphql
query {
  chessPuzzle(puzzleId: "00sBO") {
    puzzle_id
    fen
    moves
    rating
    rating_deviation
    popularity
    nb_plays
    themes
    opening_tags
    game_url
  }
}
```

---

## 5. `randomChessPuzzles` — 1 random puzzle (no filters)

```graphql
query {
  randomChessPuzzles(input: { count: 1 }) {
    puzzle_id
    fen
    moves
    rating
    themes
    opening_tags
    game_url
  }
}
```

---

## 6. `randomChessPuzzles` — 5 random puzzles filtered by rating + theme

```graphql
query {
  randomChessPuzzles(input: {
    count: 5
    minRating: 1000
    maxRating: 1400
    themes: ["endgame"]
  }) {
    puzzle_id
    fen
    moves
    rating
    themes
    opening_tags
    game_url
  }
}
```

> Max `count` is **10**.

---

## 7. `chessPuzzleThemes` — All theme tags (flat list)

```graphql
query {
  chessPuzzleThemes
}
```

---

## 8. `chessPuzzleThemesPaginated` — First page of themes with counts

```graphql
query {
  chessPuzzleThemesPaginated(input: { limit: 20 }) {
    items {
      theme
      count
    }
    hasNextPage
    nextCursor
  }
}
```

---

## 9. `chessPuzzleThemesPaginated` — Next page (paste real `nextCursor` value)

```graphql
query {
  chessPuzzleThemesPaginated(input: {
    limit: 20
    cursor: "REPLACE_WITH_nextCursor_VALUE"
  }) {
    items {
      theme
      count
    }
    hasNextPage
    nextCursor
  }
}
```

> Max `limit` is **200**, default is **50**.

---

## 10. `randomChessPuzzleTheme` — First random theme (no exclusions)

```graphql
query {
  randomChessPuzzleTheme(exclude: []) {
    theme
    count
  }
}
```

---

## 11. `randomChessPuzzleTheme` — Next random theme (excluding seen ones)

```graphql
query {
  randomChessPuzzleTheme(exclude: ["fork", "pin", "crushing"]) {
    theme
    count
  }
}
```

> Add each returned `theme` to the `exclude` list on every call.  
> When all themes are excluded a `404` error is returned — reset `exclude` to `[]` to start over.

---

## 12. `chessPuzzleOpenings` — All ECO opening tags

```graphql
query {
  chessPuzzleOpenings
}
```

---

## 13. `chessPuzzleRatingDistribution` — ELO histogram

```graphql
query {
  chessPuzzleRatingDistribution
}
```

Returns a JSON string: `[{ "bucket": 600, "count": 312 }, { "bucket": 700, "count": 1840 }, ...]`

---

## Mutations (separate pipeline — not live yet)

### Import CSV (batched INSERT)

```graphql
mutation {
  importChessPuzzlesCsv(filePath: "/data/lichess_db_puzzle.csv") {
    imported
    skipped
    durationMs
    error
  }
}
```

### Import CSV fast (PostgreSQL COPY FROM)

```graphql
mutation {
  importChessPuzzlesCsvFast(filePath: "/data/lichess_db_puzzle.csv") {
    imported
    skipped
    durationMs
    error
  }
}
```

### Trigger Lichess monthly sync

```graphql
mutation {
  syncChessPuzzles
}
```

### Force re-sync (ignore cache)

```graphql
mutation {
  syncChessPuzzlesForce
}
```

### Poll sync pipeline status

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

> `phase` values: `idle` · `downloading` · `decompressing` · `importing` · `cleaning_up` · `done` · `failed`

### Poll import row count

```graphql
query {
  chessPuzzleImportProgress
}
```


> Base URL: **`http://localhost:5100/graphql`**

---

## Queries

---

### 1. `chessPuzzles` — Paginated list with filters

All arguments are optional. Returns 20 puzzles by default (max 100).

```graphql
query ChessPuzzles(
  $minRating: Int
  $maxRating: Int
  $themes: [String!]
  $openingTags: [String!]
  $minPopularity: Int
  $limit: Int
  $cursor: String
  $sortBy: PuzzleSortField
  $sortOrder: SortOrder
) {
  chessPuzzles(
    filter: {
      minRating: $minRating
      maxRating: $maxRating
      themes: $themes
      openingTags: $openingTags
      minPopularity: $minPopularity
      limit: $limit
      cursor: $cursor
      sortBy: $sortBy
      sortOrder: $sortOrder
    }
  ) {
    items {
      puzzle_id
      fen
      moves
      rating
      rating_deviation
      popularity
      nb_plays
      themes
      opening_tags
      game_url
    }
    hasNextPage
    nextCursor
  }
}
```

**Minimal — first page, no filters:**
```graphql
query {
  chessPuzzles(filter: { limit: 20 }) {
    items { puzzle_id fen moves rating themes }
    hasNextPage
    nextCursor
  }
}
```

**Filtered by rating + theme:**
```graphql
query {
  chessPuzzles(filter: {
    minRating: 1200
    maxRating: 1600
    themes: ["fork"]
    limit: 10
    sortBy: rating
    sortOrder: ASC
  }) {
    items { puzzle_id fen moves rating themes }
    hasNextPage
    nextCursor
  }
}
```

**Next page** — paste the `nextCursor` value from the previous response:
```graphql
query {
  chessPuzzles(filter: {
    minRating: 1200
    maxRating: 1600
    themes: ["fork"]
    limit: 10
    cursor: "PASTE_NEXT_CURSOR_HERE"
  }) {
    items { puzzle_id fen moves rating themes }
    hasNextPage
    nextCursor
  }
}
```

**Variables for parameterized version:**
```json
{
  "minRating": 1200,
  "maxRating": 1600,
  "themes": ["fork"],
  "limit": 10,
  "sortBy": "rating",
  "sortOrder": "ASC"
}
```

**Available `sortBy` values:** `rating` · `popularity` · `nb_plays`  
**Available `sortOrder` values:** `ASC` · `DESC`

---

### 2. `chessPuzzle` — Single puzzle by ID

```graphql
query GetPuzzle($puzzleId: String!) {
  chessPuzzle(puzzleId: $puzzleId) {
    puzzle_id
    fen
    moves
    rating
    rating_deviation
    popularity
    nb_plays
    themes
    opening_tags
    game_url
  }
}
```

**Variables:**
```json
{ "puzzleId": "00sBO" }
```

**Inline:**
```graphql
query {
  chessPuzzle(puzzleId: "00sBO") {
    puzzle_id fen moves rating themes
  }
}
```

---

### 3. `randomChessPuzzles` — N random puzzles

```graphql
query RandomPuzzles($count: Int, $minRating: Int, $maxRating: Int, $themes: [String!]) {
  randomChessPuzzles(input: {
    count: $count
    minRating: $minRating
    maxRating: $maxRating
    themes: $themes
  }) {
    puzzle_id
    fen
    moves
    rating
    themes
    opening_tags
    game_url
  }
}
```

**Variables:**
```json
{
  "count": 5,
  "minRating": 1000,
  "maxRating": 1400,
  "themes": ["endgame"]
}
```

**Minimal — 1 random puzzle, no filters:**
```graphql
query {
  randomChessPuzzles(input: { count: 1 }) {
    puzzle_id fen moves rating themes
  }
}
```

> Max `count` is **10**.

---

### 4. `chessPuzzleThemes` — All theme tags (flat list)

```graphql
query {
  chessPuzzleThemes
}
```

Returns a plain `[String]` e.g. `["advantage", "crushing", "endgame", "fork", ...]`

---

### 5. `chessPuzzleThemesPaginated` — Themes with puzzle counts

```graphql
query ChessPuzzleThemesPaginated($limit: Int, $cursor: String) {
  chessPuzzleThemesPaginated(input: { limit: $limit, cursor: $cursor }) {
    items {
      theme
      count
    }
    hasNextPage
    nextCursor
  }
}
```

**First page (20 themes):**
```graphql
query {
  chessPuzzleThemesPaginated(input: { limit: 20 }) {
    items { theme count }
    hasNextPage
    nextCursor
  }
}
```

**Next page:**
```graphql
query {
  chessPuzzleThemesPaginated(input: { limit: 20, cursor: "PASTE_NEXT_CURSOR_HERE" }) {
    items { theme count }
    hasNextPage
    nextCursor
  }
}
```

> Max `limit` is **200**, default is **50**.

---

### 6. `randomChessPuzzleTheme` — One random theme (no repeats)

Returns a theme the client hasn't seen yet. Pass already-returned themes in `exclude`.

```graphql
query RandomTheme($exclude: [String!]) {
  randomChessPuzzleTheme(exclude: $exclude) {
    theme
    count
  }
}
```

**First call (no exclusions):**
```graphql
query {
  randomChessPuzzleTheme(exclude: []) {
    theme
    count
  }
}
```

**Subsequent calls — add each returned theme to the list:**
```graphql
query {
  randomChessPuzzleTheme(exclude: ["fork", "pin", "crushing"]) {
    theme
    count
  }
}
```

**Variables example:**
```json
{ "exclude": ["fork", "pin", "crushing", "endgame"] }
```

> When all themes are excluded a `NotFoundException` is returned — reset `exclude` to `[]` to start over.

---

### 7. `chessPuzzleOpenings` — All ECO opening tags

```graphql
query {
  chessPuzzleOpenings
}
```

Returns `[String]` e.g. `["A00", "B20_sicilian", ...]`

---

### 8. `chessPuzzleRatingDistribution` — Rating histogram

```graphql
query {
  chessPuzzleRatingDistribution
}
```

Returns a JSON string of `{ bucket: number, count: number }[]` in 100-point ELO buckets:

```json
[
  { "bucket": 600,  "count": 312  },
  { "bucket": 700,  "count": 1840 },
  { "bucket": 800,  "count": 5221 },
  ...
]
```

---

## Mutations (handled by separate pipeline — not in PuzzleModule)

| Mutation | Description |
|---|---|
| `importChessPuzzlesCsv(filePath: String!)` | Batched INSERT import from a server-side CSV path |
| `importChessPuzzlesCsvFast(filePath: String!)` | PostgreSQL `COPY FROM` import (~3× faster) |
| `syncChessPuzzles` | Trigger Lichess monthly sync (background) |
| `syncChessPuzzlesForce` | Force re-download even if cached this month |
| `syncChessPuzzlesStatus` *(query)* | Poll sync pipeline phase/progress |
| `chessPuzzleImportProgress` *(query)* | Poll row count during an active import |

See individual mutation signatures in the sections below.

### `importChessPuzzlesCsv`
```graphql
mutation {
  importChessPuzzlesCsv(filePath: "/data/lichess_db_puzzle.csv") {
    imported
    skipped
    durationMs
    error
  }
}
```

### `importChessPuzzlesCsvFast`
```graphql
mutation {
  importChessPuzzlesCsvFast(filePath: "/data/lichess_db_puzzle.csv") {
    imported
    skipped
    durationMs
    error
  }
}
```

### `syncChessPuzzles`
```graphql
mutation {
  syncChessPuzzles
}
```

### `syncChessPuzzlesForce`
```graphql
mutation {
  syncChessPuzzlesForce
}
```

### `syncChessPuzzlesStatus`
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
`phase` values: `idle` · `downloading` · `decompressing` · `importing` · `cleaning_up` · `done` · `failed`

### `chessPuzzleImportProgress`
```graphql
query {
  chessPuzzleImportProgress
}
```


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
