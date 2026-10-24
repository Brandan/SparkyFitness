import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlannedMealItem } from '@workspace/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdatePlannedFoodMutation } from '@/hooks/Foods/usePlannedMeals';

interface PlannedFoodEditDialogProps {
  item: PlannedMealItem | null;
  onClose: () => void;
}

const QuantityForm = ({
  item,
  onClose,
}: {
  item: PlannedMealItem;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const update = useUpdatePlannedFoodMutation();
  const [quantity, setQuantity] = useState(String(item.quantity));

  const parsed = Number(quantity);
  const valid = quantity.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  const handleSave = () => {
    if (!valid) return;
    update.mutate(
      { id: item.item_key, quantity: parsed },
      { onSuccess: onClose }
    );
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="plannedFoodQuantity">
          {t('plannedMeals.amount', 'Amount ({{unit}})', { unit: item.unit })}
        </Label>
        <Input
          id="plannedFoodQuantity"
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
        <Button
          type="submit"
          className="min-h-11"
          disabled={!valid || update.isPending}
        >
          {t('common.save', 'Save')}
        </Button>
      </DialogFooter>
    </form>
  );
};

/** Changes how much of a one-off planned food is planned. */
const PlannedFoodEditDialog = ({
  item,
  onClose,
}: PlannedFoodEditDialogProps) => {
  const { t } = useTranslation();
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('plannedMeals.changeAmountTitle', 'Change {{name}}', {
              name: item?.name ?? '',
            })}
          </DialogTitle>
        </DialogHeader>
        {item && (
          <QuantityForm key={item.item_key} item={item} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlannedFoodEditDialog;
