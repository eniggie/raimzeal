# Applied Migrations Log

## 006_user_app_data — Applied 2026-05-22

Executed via Supabase Management API against project `druogyuqjytmkwihinhg`.

### Tables created
| table | columns | RLS policy |
|---|---|---|
| workout_logs | 9 | workout_logs: owner access |
| meal_logs | 10 | meal_logs: owner access |
| body_measurements | 10 | body_measurements: owner access |
| water_intake | 5 | water_intake: owner access |
| scheduled_workouts | 7 | scheduled_workouts: owner access |

### profiles columns added
| column | type |
|---|---|
| app_settings | jsonb |
| streak | integer |
| blood_type | text |
| rh_factor | text |
| genotype | text |

---

## 007_coach_messages — Applied 2026-05-22

### Tables created
| table | columns | RLS policy |
|---|---|---|
| coach_messages | 6 | Users can manage own coach messages |

---

---

## 004_ovia_messages — Applied 2026-06-24

Executed via Supabase Management API (SUPABASE_PAT) during OSA MODE audit.
Previously unapplied despite file existing since project creation.

### Tables created
| table | columns | RLS policy |
|---|---|---|
| ovia_messages | 5 | Users can read/upsert/update own ovia messages |

---

## 005_user_preferences — Applied 2026-06-24

Executed via Supabase Management API during OSA MODE audit.
Previously unapplied.

### profiles columns added
| column | type |
|---|---|
| preferences | jsonb |

---

## 008_favourite_foods — Applied 2026-06-24

New migration written and applied during OSA MODE audit.
Table was referenced in API routes but never existed in Supabase.

### Tables created
| table | columns | RLS policy |
|---|---|---|
| favourite_foods | 7 | favourite_foods: owner access |

---

_Migrations executed via `POST https://api.supabase.com/v1/projects/{ref}/database/query`._
_SQL files updated: `CREATE POLICY IF NOT EXISTS` replaced with `DROP POLICY IF EXISTS` + `CREATE POLICY` for PG15 compatibility._
