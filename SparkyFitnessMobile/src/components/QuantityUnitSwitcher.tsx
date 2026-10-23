import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import SegmentedControl from './SegmentedControl';
import { localizeFoodUnit } from '../utils/foodUnitLocalization';

interface QuantityUnitSwitcherProps {
  /** Units to offer; renders nothing unless there is a real choice. */
  choices: string[];
  unit: string;
  onSelect: (unit: string) => void;
}

/**
 * One-tap unit row shown under a quantity stepper (g / oz / lb / kg, or
 * ml / fl oz / cup ...). Every unit is visible at once so switching never
 * needs a menu.
 */
function QuantityUnitSwitcher({
  choices,
  unit,
  onSelect,
}: QuantityUnitSwitcherProps) {
  const { t } = useTranslation();
  if (choices.length < 2) return null;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('quantityUnit.enterIn', {
        defaultValue: 'Enter quantity in',
      })}
    >
      <SegmentedControl
        segments={choices.map((choice) => ({
          key: choice,
          label: localizeFoodUnit(choice, t),
        }))}
        activeKey={unit}
        onSelect={onSelect}
      />
    </View>
  );
}

export default QuantityUnitSwitcher;
