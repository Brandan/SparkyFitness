import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useCSSVariable } from 'uniwind';
import Button from './ui/Button';
import Icon from './Icon';
import { sheetContainer, useSheetBackdrop } from './ui/sheetChrome';

export interface CopyDaySheetRef {
  /** Open for `fromDay` (0 = Sunday); `itemCounts[d]` is what day `d` holds now. */
  present: (fromDay: number, itemCounts: number[]) => void;
  dismiss: () => void;
}

interface CopyDaySheetProps {
  dayNames: string[];
  onCopy: (fromDay: number, toDays: number[]) => void;
}

/** Pick the days a single day of a meal plan should be copied onto. */
const CopyDaySheet = forwardRef<CopyDaySheetRef, CopyDaySheetProps>(
  ({ dayNames, onCopy }, ref) => {
    const { t } = useTranslation();
    const sheetRef = useRef<BottomSheetModal>(null);
    const renderBackdrop = useSheetBackdrop();
    const [surfaceBg, textMuted, accentPrimary, textMutedIcon] = useCSSVariable(
      [
        '--color-surface',
        '--color-text-muted',
        '--color-accent-primary',
        '--color-text-muted',
      ]
    ) as [string, string, string, string];

    const [source, setSource] = useState<{
      fromDay: number;
      itemCounts: number[];
    } | null>(null);
    const [selected, setSelected] = useState<number[]>([]);

    useImperativeHandle(ref, () => ({
      present: (fromDay, itemCounts) => {
        setSource({ fromDay, itemCounts });
        // Empty days are the safe default; a day with items is only replaced
        // if the person picks it.
        setSelected(
          [0, 1, 2, 3, 4, 5, 6].filter(
            (day) => day !== fromDay && (itemCounts[day] ?? 0) === 0
          )
        );
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const days = source
      ? [0, 1, 2, 3, 4, 5, 6].filter((day) => day !== source.fromDay)
      : [];
    const allSelected = days.length > 0 && selected.length === days.length;

    const toggle = useCallback((day: number) => {
      setSelected((current) =>
        current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day]
      );
    }, []);

    return (
      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        enableContentPanningGesture={Platform.OS !== 'android'}
        backdropComponent={renderBackdrop}
        containerComponent={sheetContainer}
        backgroundStyle={{ backgroundColor: surfaceBg }}
        handleIndicatorStyle={{ backgroundColor: textMuted }}
      >
        <BottomSheetScrollView contentContainerClassName="pb-safe-or-8">
          {source && (
            <View className="px-5">
              <View className="items-center mb-3">
                <Text className="text-text-primary text-lg font-semibold text-center">
                  {t('mealPlans.copyDayTitle', {
                    defaultValue: 'Copy {{day}} to',
                    day: dayNames[source.fromDay],
                  })}
                </Text>
                <Text className="text-text-secondary text-sm mt-1 text-center">
                  {t('mealPlans.copyDayHint', {
                    defaultValue:
                      'Everything planned for {{day}} is copied to the days you pick.',
                    day: dayNames[source.fromDay],
                  })}
                </Text>
              </View>

              <Button
                variant="ghost"
                className="self-end py-2 px-3"
                onPress={() => setSelected(allSelected ? [] : days)}
              >
                {allSelected
                  ? t('mealPlans.copyDayClear', { defaultValue: 'Clear' })
                  : t('mealPlans.copyDaySelectAll', {
                      defaultValue: 'Select all',
                    })}
              </Button>

              {days.map((day) => {
                const checked = selected.includes(day);
                const count = source.itemCounts[day] ?? 0;
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={dayNames[day]}
                    onPress={() => toggle(day)}
                    className="flex-row items-center gap-3 min-h-12 px-1"
                  >
                    <Icon
                      name={
                        checked ? 'checkmark-circle-filled' : 'checkmark-circle'
                      }
                      size={24}
                      color={checked ? accentPrimary : textMutedIcon}
                    />
                    <Text className="flex-1 text-base text-text-primary">
                      {dayNames[day]}
                    </Text>
                    {count > 0 && (
                      <Text className="text-xs text-text-muted">
                        {t('mealPlans.copyDayReplaces', {
                          defaultValue: 'Replaces {{count}} items',
                          count,
                        })}
                      </Text>
                    )}
                  </Pressable>
                );
              })}

              <Button
                variant="primary"
                className="mt-4"
                disabled={selected.length === 0}
                onPress={() => {
                  onCopy(source.fromDay, selected);
                  sheetRef.current?.dismiss();
                }}
              >
                {t('mealPlans.copyDayConfirm', {
                  defaultValue: 'Copy to {{count}} days',
                  count: selected.length,
                })}
              </Button>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

CopyDaySheet.displayName = 'CopyDaySheet';

export default CopyDaySheet;
