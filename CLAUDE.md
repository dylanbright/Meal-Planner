# Meal Planner

## Overview
A home network web app for tracking our dinner repertoire. Built with Node.js/Express, storing data in `data/meals.json`. Run with `npm start` (port 3007).

## AI features
The "Clean up with AI" button on the meal form uses the Anthropic API (claude-haiku-4-5-20251001) to extract ingredients from pasted text. Requires `ANTHROPIC_API_KEY` set in a `.env` file in the project root (see `.env.example`). The rest of the app works fine without it.

## Data file
`data/meals.json` contains real user data. Never clear, overwrite, or reset this file during development. Always back it up before running migrations.

## Meal schema
| Field | Type | Notes |
|---|---|---|
| `id` | string | Timestamp-based, set on create |
| `name` | string | Required |
| `nights` | number | How many nights the meal covers, default 1 |
| `recipeUrl` | string | Optional |
| `notes` | string | Optional |
| `specialIngredients` | string[] | Optional, default `[]` — items to flag in shopping lists |
| `ingredients` | string[] | Optional, default `[]` — full ingredient list fetched from recipe |
| `lastHad` | string (YYYY-MM-DD) | Optional, `null` if unset |
| `createdAt` | ISO string | Set on create |
| `updatedAt` | ISO string | Set on edit, may be absent on older records |

## Adding new fields
New fields must be optional with safe defaults so existing records without that field continue to work. Update the schema table above whenever a field is added or changed.

## Schema migrations
If a change requires backfilling a new field onto existing records, create a one-off script in `migrations/` (e.g. `migrations/add-fieldname.js`) that:
1. Reads `data/meals.json`
2. Adds the field with a safe default to any record missing it
3. Writes the result back

Never migrate data silently inside `server.js` on startup. Migration scripts must be explicit and run manually by the user.
