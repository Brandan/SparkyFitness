import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Meal } from '@/types/meal';

interface PlanMealDialogProps {
  meal: Meal | null;
  /** Name of the diary meal the item is planned for, e.g. Lunch. */
  mealName: string;
  onClose: () => void;
  onPlan: (meal: Meal, quantity: number, unit: string) => Promise<void>;
}

/** One serving, or one portion's worth when the meal is measured in grams, cups, etc. */
const defaultQuantity = (meal: Meal) =>
  (meal.serving_unit ?? 'serving') === 'serving' ? 1 : (meal.serving_size ?? 1);

const PlanMealForm = ({
  meal,
  onClose,
  onPlan,
}: {
  meal: Meal;
  onClose: () => void;
  onPlan: PlanMealDialogProps['onPlan'];
}) => {
  const { t } = useTranslation();
  const unit = meal.serving_unit ?? 'serving';
  const [quantity, setQuantity] = useState(String(defaultQuantity(meal)));
  const [saving, setSaving] = useState(false);

  const parsed = Number(quantity);
  const valid = quantity.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onPlan(meal, parsed, unit);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="planMealQuantity">
          {t('plannedMeals.amount', 'Amount ({{unit}})', { unit })}
        </Label>
        <Input
          id="planMealQuantity"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          autoFocus
          className="min-h-11"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          aria-invalid={!valid}
        />
        {!valid && (
          <p className="text-sm text-destructive">
            {t('plannedMeals.amountInvalid', 'Enter an amount above 0.')}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onClose}
        >
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button type="submit" className="min-h-11" disabled={!valid || saving}>
          {t('plannedMeals.addToPlan', 'Add to Plan')}
        </Button>
      </DialogFooter>
    </form>
  );
};

/** Asks how much of a saved meal to plan, then plans it as one item. */
const PlanMealDialog = ({
  meal,
  mealName,
  onClose,
  onPlan,
}: PlanMealDialogProps) => {
  const { t } = useTranslation();
  return (
    <Dialog open={meal !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('plannedMeals.planMealTitle', 'Plan {{name}}', {
              name: meal?.name ?? '',
            })}
          </DialogTitle>
          <DialogDescription>
            {t(
              'plannedMeals.planMealDescription',
              'Planned for {{mealName}}. It is not in your totals until you add it to the diary.',
              { mealName }
            )}
          </DialogDescription>
        </DialogHeader>
        {meal && (
          <PlanMealForm
            key={meal.id ?? meal.name}
            meal={meal}
            onClose={onClose}
            onPlan={onPlan}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlanMealDialog;
