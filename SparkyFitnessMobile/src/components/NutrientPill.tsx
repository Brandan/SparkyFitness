import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

interface NutrientPillProps {
  label: string;
  consumed: number;
  goal?: number;
  unit?: string;
  /** What the day's planned meals would add; shown on a second line when above 0. */
  planned?: number;
}

const NutrientPill: React.FC<NutrientPillProps> = ({
  label,
  consumed,
  goal,
  unit = 'g',
  planned = 0,
}) => {
  const { t } = useTranslation();
  const roundedPlanned = Math.round(planned);
  return (
    <View className="w-[23%] bg-border rounded-xl px-0.5 py-2 items-center">
      <Text className="text-xs text-text-primary mb-1" numberOfLines={1}>
        {label}
      </Text>
      <Text
        className="text-xs font-bold text-text-primary text-center"
        numberOfLines={1}
      >
        {goal && goal > 0
          ? `${Math.round(consumed)}${unit} / ${Math.round(goal)}${unit}`
          : `${Math.round(consumed)}${unit}`}
      </Text>
      {roundedPlanned > 0 && (
        <Text
          className="text-xs text-text-muted text-center mt-0.5"
          numberOfLines={1}
        >
          {t('diarySummary.plannedAmount', {
            defaultValue: '+{{value}} planned',
            value: `${roundedPlanned}${unit}`,
          })}
        </Text>
      )}
    </View>
  );
};

export default NutrientPill;
