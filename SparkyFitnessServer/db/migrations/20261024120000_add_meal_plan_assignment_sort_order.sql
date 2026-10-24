-- The order of a meal plan's items within each day and meal, set by dragging
-- them in the plan form. Items a plan adds to the diary go in this order.
ALTER TABLE meal_plan_template_assignments
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN meal_plan_template_assignments.sort_order IS
  'Position of the item within its plan; lower first. Rewritten on every save.';

-- Number existing items in the order they were saved. A plan's items are
-- deleted and re-inserted together on every save, so physical row order is
-- the order the plan form sent them in.
UPDATE meal_plan_template_assignments a
   SET sort_order = numbered.position
  FROM (
    SELECT id,
           (row_number() OVER (PARTITION BY template_id ORDER BY ctid) - 1)::integer AS position
      FROM meal_plan_template_assignments
  ) numbered
 WHERE a.id = numbered.id
   AND a.sort_order = 0;
