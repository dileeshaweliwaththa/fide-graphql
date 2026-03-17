# Chess Puzzle — GraphQL Playground Reference

> Base URL: **`http://localhost:5100/graphql`**  
> All queries below are **copy-paste ready** — no variables panel needed.

---

## Difficulty Tiers

Lichess puzzles have no explicit "difficulty" column. Difficulty is represented by the **Glicko-2 `rating`** field. The `DifficultyTier` enum is a shorthand that maps to rating ranges:

| Enum value      | Rating range  | Description                       |
|-----------------|---------------|-----------------------------------|
| `BEGINNER`      | < 1000        | Brand new to tactics              |
| `EASY`          | 1000 – 1499   | Club / casual players             |
| `INTERMEDIATE`  | 1500 – 1999   | Active tournament players         |
| `HARD`          | 2000 – 2499   | Strong club / online rated        |
| `EXPERT`        | 2500+         | Master level                      |

`difficulty` stacks with explicit `minRating` / `maxRating` — the tighter bound always wins.  
e.g. `difficulty: EASY, minRating: 1200` → effective range **1200–1499**.

---

## 1. `chessPuzzles` — First page, no filters

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

## 2. `chessPuzzles` — Filter by difficulty tier

```graphql
query {
  chessPuzzles(filter: {
    difficulty: INTERMEDIATE
    limit: 10
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

## 3. `chessPuzzles` — Difficulty tier + theme + sort

```graphql
query {
  chessPuzzles(filter: {
    difficulty: HARD
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

## 4. `chessPuzzles` — Explicit rating range (no tier)

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

> `sortBy` options: `rating` · `popularity` · `nb_plays`  
> `sortOrder` options: `ASC` · `DESC`

---

## 5. `chessPuzzles` — Next page

Replace the cursor value with the `nextCursor` returned from the previous response.

```graphql
query {
  chessPuzzles(filter: {
    difficulty: HARD
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

---

## 6. `chessPuzzle` — Single puzzle by ID

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

## 7. `randomChessPuzzles` — 1 random puzzle (no filters)

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

## 8. `randomChessPuzzles` — By difficulty tier

```graphql
query {
  randomChessPuzzles(input: {
    count: 5
    difficulty: EASY
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

---

## 9. `randomChessPuzzles` — Difficulty tier + theme

```graphql
query {
  randomChessPuzzles(input: {
    count: 3
    difficulty: INTERMEDIATE
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

## 10. `chessPuzzleThemes` — All theme tags (flat list)

```graphql
query {
  chessPuzzleThemes
}
```

---

## 11. `chessPuzzleThemesPaginated` — First page of themes with counts

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

## 12. `chessPuzzleThemesPaginated` — Next page

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

## 13. `randomChessPuzzleTheme` — First random theme (no exclusions)

```graphql
query {
  randomChessPuzzleTheme(exclude: []) {
    theme
    count
  }
}
```

---

## 14. `randomChessPuzzleTheme` — Exclude already-seen themes

```graphql
query {
  randomChessPuzzleTheme(exclude: ["fork", "pin", "crushing"]) {
    theme
    count
  }
}
```

> Append each returned `theme` to the `exclude` list on every call.  
> When all themes are excluded a `404` is returned — reset `exclude` to `[]` to start over.

---

## 15. `chessPuzzleOpenings` — All ECO opening tags

```graphql
query {
  chessPuzzleOpenings
}
```

---

## 16. `chessPuzzleRatingDistribution` — ELO histogram

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
