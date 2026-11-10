-- One-off planned items can now be a saved meal as well as a single food. A row
-- is either a food (food_id + variant_id) or a meal (meal_id), never both.
ALTER TABLE planned_food_items ALTER COLUMN food_id DROP NOT NULL;
ALTER TABLE planned_food_items ALTER COLUMN variant_id DROP NOT NULL;
ALTER TABLE planned_food_items
  ADD COLUMN IF NOT EXISTS meal_id uuid REFERENCES meals(id) ON DELETE CASCADE;
-- The logged meal an add wrote, so undo removes exactly that meal and its foods.
ALTER TABLE planned_food_items
  ADD COLUMN IF NOT EXISTS food_entry_meal_id uuid REFERENCES food_entry_meals(id) ON DELETE SET NULL;
ALTER TABLE planned_food_items DROP CONSTRAINT IF EXISTS planned_food_items_subject_check;
ALTER TABLE planned_food_items ADD CONSTRAINT planned_food_items_subject_check CHECK (
  (meal_id IS NOT NULL AND food_id IS NULL AND variant_id IS NULL)
  OR (meal_id IS NULL AND food_id IS NOT NULL AND variant_id IS NOT NULL)
);
