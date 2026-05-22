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

_Migrations executed via `POST https://api.supabase.com/v1/projects/{ref}/database/query`._
_SQL files updated: `CREATE POLICY IF NOT EXISTS` replaced with `DROP POLICY IF EXISTS` + `CREATE POLICY` for PG15 compatibility._
