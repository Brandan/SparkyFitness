-- One-off planned foods: a food the person expects to eat on a given day and
-- meal, without building a meal plan. They show next to plan-based planned
-- items and are not diary entries until the person adds them.
CREATE TABLE IF NOT EXISTS planned_food_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  meal_type_id uuid NOT NULL REFERENCES meal_types(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES food_variants(id) ON DELETE CASCADE,
  quantity numeric(10, 2) NOT NULL CHECK (quantity > 0),
  unit varchar(50) NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'added', 'skipped')),
  -- The diary entry an add wrote, so undo removes exactly that entry.
  food_entry_id uuid REFERENCES food_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planned_food_items_user_date
  ON planned_food_items(user_id, plan_date);
ALTER TABLE planned_food_items ENABLE ROW LEVEL SECURITY;
-- Policies are installed by the canonical db/rls_policies.sql.
