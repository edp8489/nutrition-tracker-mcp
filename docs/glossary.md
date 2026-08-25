# Glossary — Nutrition Tracker

| Term        | Definition                                                                                          |
|-------------|-----------------------------------------------------------------------------------------------------|
| Food        | A single ingredient row from the OpenNutrition dataset. Identified by dataset id.                  |
| Recipe      | A named list of ingredients (foods + quantity + unit) with a user-defined portion count. No nested recipes in MVP. |
| Ingredient  | One line of a recipe: `{ foodRef, quantity, unit }`.                                                |
| Portion     | User-defined count of servings a recipe yields. Recipe nutrition = sum of ingredients ÷ portions.  |
| Log Entry   | A record of consumption at a loose timestamp (date + hour). References a food or a recipe and stores a frozen macro snapshot. |
| Snapshot    | Per-portion macro values (kcal, protein, carbs, fat) copied into a log entry at creation time. Immutable. |
| Macros      | The four MVP macronutrients: calories (kcal), protein (g), carbohydrates (g), fat (g).              |
| Category    | A coarse classification filter on foods (e.g., fruit, vegetable, branded, restaurant). Source fields TBD in Round 2. |
| Favorite    | A user-flagged food for quick access in search. Stored as a flag/shortlist.                         |
| Recent      | A food or recipe recently logged or searched, surfaced as a shortcut.                               |
| Dataset     | The OpenNutrition foods dataset (TSV, ~111MB uncompressed), delivered hybrid (build subset + chunked backend). |
| Subset      | The slimmed build-time set of common/generic foods bundled in `dist/` for first-paint usability.     |
| Chunk       | A static file on the nginx backend holding a slice of the parsed dataset, fetched lazily and cached in IndexedDB. |
| Day         | A local calendar day (no timezone gymnastics). Used for report aggregation.                          |
| Hour        | Loose timestamp precision: date + hour-of-day (0–23). Minutes/seconds not captured.                 |
