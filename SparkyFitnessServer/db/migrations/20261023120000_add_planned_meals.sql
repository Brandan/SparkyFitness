-- Planned meals: a meal plan can show its items on the diary as "planned"
-- instead of writing diary entries up front. Existing plans keep auto-adding.
ALTER TABLE meal_plan_templates
  ADD COLUMN IF NOT EXISTS auto_log boolean NOT NULL DEFAULT true;

-- Remembers which planned items were added to, or skipped on, a given day so
-- they never come back after the user acts on them (even if the resulting
-- diary entries are deleted later).
CREATE TABLE IF NOT EXISTS meal_plan_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES meal_plan_templates(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  item_key text NOT NULL CHECK (length(item_key) BETWEEN 1 AND 200),
  status text NOT NULL CHECK (status IN ('added', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, plan_date, item_key)
);
CREATE INDEX IF NOT EXISTS meal_plan_occurrences_user_date
  ON meal_plan_occurrences(user_id, plan_date);
ALTER TABLE meal_plan_occurrences ENABLE ROW LEVEL SECURITY;
-- Owner-only policies are installed by the canonical db/rls_policies.sql.
