import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { formatDateToYYYYMMDD } from '@/lib/utils';
import { Trans, useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePreferences } from '@/contexts/PreferencesContext';
import { debug, error } from '@/utils/logging';
import { toast } from '@/hooks/use-toast';
import type {
  MealPlanTemplate,
  Meal,
  MealPlanTemplateAssignment,
} from '@/types/meal';
import type { Food, FoodVariant } from '@/types/food';
import FoodUnitSelector from '@/components/FoodUnitSelector';
import MealUnitSelector from './MealUnitSelector';
import CopyDayDialog from './CopyDayDialog';
import { ToastAction } from '@/components/ui/toast';
import { copyDayAssignments, countAssignmentsByDay } from '@workspace/shared';
import { Copy, Edit, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { mealViewOptions } from '@/hooks/Foods/useMeals';
import { foodViewOptions } from '@/hooks/Foods/useFoods';
import { foodVariantsOptions } from '@/hooks/Foods/useFoodVariants';
import {
  scaleAssignmentNutrition,
  selectVariantForQuantity,
} from '@/utils/mealPlanAssignmentNutrition';
import FoodSearchDialog from '@/components/FoodSearch/FoodSearchDialog';
import { useMealTypes } from '@/hooks/Diary/useMealTypes';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableRow from '@/components/SortableRow';
import ImageLightbox from '@/components/ImageLightbox';
import { useImageLightbox } from '@/hooks/Foods/useImageLightbox';
import { mealDisplayImages, usableFoodImages } from '@/utils/foodImages';

// Extended assignment type with nutrition data for display.
// `images` and `brand` are display-only and are never saved with the plan.
interface ExtendedAssignment extends MealPlanTemplateAssignment {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  serving_size?: number;
  serving_unit?: string;
  total_servings?: number;
  images?: string[];
  brand?: string | null;
}

function displayBrand(brand: string | null | undefined): string | null {
  const trimmed = brand?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

interface MealPlanTemplateFormProps {
  template?: MealPlanTemplate;
  onSave: (template: Partial<MealPlanTemplate>) => void;
  onClose: () => void;
}

const MealPlanTemplateForm: React.FC<MealPlanTemplateFormProps> = ({
  template,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();
  const { loggingLevel } = usePreferences(); // Get loggingLevel from preferences
  const [planName, setPlanName] = useState(template?.plan_name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [startDate, setStartDate] = useState(
    template?.start_date
      ? String(template.start_date).split('T')[0]
      : formatDateToYYYYMMDD(new Date())
  );
  const [endDate, setEndDate] = useState(() => {
    if (template?.end_date) return String(template.end_date).split('T')[0];
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return formatDateToYYYYMMDD(date);
  });
  const [isActive, setIsActive] = useState(template?.is_active || false);
  // New plans start as "show as planned"; plans saved earlier keep adding automatically.
  const [autoLog, setAutoLog] = useState(
    template ? template.auto_log !== false : false
  );
  const [assignments, setAssignments] = useState<MealPlanTemplateAssignment[]>(
    template?.assignments || []
  );
  const [extendedAssignments, setExtendedAssignments] = useState<
    ExtendedAssignment[]
  >([]);
  const [isFoodSelectionOpen, setIsFoodSelectionOpen] = useState(false);
  const [isFoodUnitSelectorOpen, setIsFoodUnitSelectorOpen] = useState(false);
  const [isMealUnitSelectorOpen, setIsMealUnitSelectorOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const [copySourceDay, setCopySourceDay] = useState<number | null>(null);
  const [currentMealType, setCurrentMealType] = useState<string | null>(null);
  const [editingAssignmentIndex, setEditingAssignmentIndex] = useState<
    number | null
  >(null);

  const queryClient = useQueryClient();
  const { data: availableMealTypes = [] } = useMealTypes();
  const { lightboxProps, openLightbox } = useImageLightbox();
  // Helper function to fetch nutrition data for an assignment
  const fetchNutritionForAssignment = useCallback(
    async (
      assignment: MealPlanTemplateAssignment
    ): Promise<ExtendedAssignment> => {
      try {
        if (assignment.item_type === 'meal' && assignment.meal_id) {
          const meal = await queryClient.fetchQuery(
            mealViewOptions(assignment.meal_id)
          );
          if (meal) {
            const images = mealDisplayImages(meal);
            if (meal.foods) {
              // Calculate total nutrition from meal's component foods
              let totalCalories = 0;
              let totalProtein = 0;
              let totalCarbs = 0;
              let totalFat = 0;

              meal.foods.forEach((mf) => {
                const scaled = scaleAssignmentNutrition(mf);
                totalCalories += scaled.calories;
                totalProtein += scaled.protein;
                totalCarbs += scaled.carbs;
                totalFat += scaled.fat;
              });

              return {
                ...assignment,
                calories: totalCalories,
                protein: totalProtein,
                carbs: totalCarbs,
                fat: totalFat,
                serving_size: meal.serving_size || 1,
                serving_unit: meal.serving_unit || 'serving',
                total_servings: meal.total_servings || 1,
                images,
              };
            }
            return { ...assignment, images };
          }
        } else if (assignment.item_type === 'food' && assignment.food_id) {
          const food = await queryClient.fetchQuery(
            foodViewOptions(assignment.food_id)
          );
          const images = usableFoodImages(food?.images);
          const brand = displayBrand(food?.brand);

          // The plan stores the serving the person picked (often ounces).
          // Dividing that quantity into the default serving treats 1 oz as
          // 1 ml or 1 g. Use the saved serving when its unit matches, and
          // otherwise a serving the row's unit can be converted into.
          let variants: FoodVariant[] = food?.default_variant
            ? [food.default_variant]
            : [];
          try {
            const loaded = await queryClient.fetchQuery(
              foodVariantsOptions(assignment.food_id)
            );
            if (loaded.length > 0) variants = loaded;
          } catch (variantError) {
            error(
              loggingLevel,
              'Failed to fetch food variants for plan nutrition:',
              variantError
            );
          }
          const variant = selectVariantForQuantity(
            variants,
            assignment.variant_id,
            assignment.unit
          );
          if (variant) {
            return {
              ...assignment,
              calories: Number(variant.calories) || 0,
              protein: Number(variant.protein) || 0,
              carbs: Number(variant.carbs) || 0,
              fat: Number(variant.fat) || 0,
              serving_size: Number(variant.serving_size) || 1,
              serving_unit: variant.serving_unit ?? undefined,
              images,
              brand,
            };
          }
          return { ...assignment, images, brand };
        }
      } catch (err) {
        error(loggingLevel, `Failed to fetch nutrition for assignment:`, err);
      }
      return { ...assignment }; // Return without nutrition if fetch fails
    },
    [loggingLevel, queryClient]
  );

  // Fetch nutrition data for existing assignments when template loads
  useEffect(() => {
    const loadNutritionForAssignments = async () => {
      if (template?.assignments && template.assignments.length > 0) {
        const extendedPromises = template.assignments.map((assignment) =>
          fetchNutritionForAssignment(assignment)
        );
        const extendedResults = await Promise.all(extendedPromises);
        setExtendedAssignments(extendedResults);
      }
    };

    loadNutritionForAssignments();
  }, [
    template?.id,
    setExtendedAssignments,
    fetchNutritionForAssignment,
    template?.assignments,
  ]); // Only run when template ID changes

  const handleAddFood = (day: number, mealType: string) => {
    setCurrentDay(day);
    setCurrentMealType(mealType);
    setIsFoodSelectionOpen(true);
  };

  const handleMealUnitSelected = async (
    meal: Meal,
    quantity: number,
    unit: string
  ) => {
    if (currentDay === null || currentMealType === null) return;

    if (editingAssignmentIndex !== null) {
      const assignmentAtIndex = assignments[editingAssignmentIndex];
      if (assignmentAtIndex) {
        // Update existing assignment
        const updatedAssignment: MealPlanTemplateAssignment = {
          ...assignmentAtIndex,
          quantity,
          unit,
        };
        const updatedAssignments = [...assignments];
        updatedAssignments[editingAssignmentIndex] = updatedAssignment;
        setAssignments(updatedAssignments);

        // Update extended assignments
        const extendedAssignment =
          await fetchNutritionForAssignment(updatedAssignment);
        const updatedExtended = [...extendedAssignments];
        updatedExtended[editingAssignmentIndex] = extendedAssignment;
        setExtendedAssignments(updatedExtended);

        setEditingAssignmentIndex(null);
      }
    } else {
      // Add new assignment
      const newAssignment: MealPlanTemplateAssignment = {
        item_type: 'meal',
        day_of_week: currentDay,
        meal_type: currentMealType,
        meal_id: meal.id,
        meal_name: meal.name,
        quantity: quantity,
        unit: unit,
      };
      setAssignments((prev) => [...prev, newAssignment]);

      // Fetch and add to extended assignments
      const extendedAssignment =
        await fetchNutritionForAssignment(newAssignment);
      setExtendedAssignments((prev) => [...prev, extendedAssignment]);
    }

    setIsMealUnitSelectorOpen(false);
    setSelectedMeal(null);
  };

  const handleFoodSelected = (item: Food | Meal, type: 'food' | 'meal') => {
    if (currentDay === null || currentMealType === null) return;

    setIsFoodSelectionOpen(false);

    if (type === 'meal') {
      const meal = item as Meal;
      // Open quantity selector for meals instead of directly adding
      setSelectedMeal(meal);
      setIsMealUnitSelectorOpen(true);
    } else {
      const food = item as Food;
      setSelectedFood(food);
      setIsFoodUnitSelectorOpen(true);
    }
  };

  const handleFoodUnitSelected = async (
    food: Food,
    quantity: number,
    unit: string,
    selectedVariant: FoodVariant
  ) => {
    if (currentDay === null || currentMealType === null) return;

    if (editingAssignmentIndex !== null) {
      const assignmentAtIndex = assignments[editingAssignmentIndex];
      // Update existing assignment
      if (assignmentAtIndex) {
        const updatedAssignment: MealPlanTemplateAssignment = {
          ...assignmentAtIndex,
          quantity,
          unit,
          variant_id: selectedVariant.id,
        };
        const updatedAssignments = [...assignments];
        updatedAssignments[editingAssignmentIndex] = updatedAssignment;
        setAssignments(updatedAssignments);

        // Update extended assignments with nutrition data
        const extendedAssignment: ExtendedAssignment = {
          ...updatedAssignment,
          calories: selectedVariant.calories,
          protein: selectedVariant.protein,
          carbs: selectedVariant.carbs,
          fat: selectedVariant.fat,
          serving_size: selectedVariant.serving_size,
          serving_unit: selectedVariant.serving_unit,
          images: usableFoodImages(food.images),
          brand: displayBrand(food.brand),
        };
        const updatedExtended = [...extendedAssignments];
        updatedExtended[editingAssignmentIndex] = extendedAssignment;
        setExtendedAssignments(updatedExtended);

        setEditingAssignmentIndex(null);
      }
    } else {
      // Add new assignment
      const newAssignment: MealPlanTemplateAssignment = {
        item_type: 'food',
        day_of_week: currentDay,
        meal_type: currentMealType,
        food_id: food.id,
        food_name: food.name,
        variant_id: selectedVariant.id,
        quantity: quantity,
        unit: unit,
      };
      setAssignments((prev) => [...prev, newAssignment]);

      // Add to extended assignments with nutrition data
      const extendedAssignment: ExtendedAssignment = {
        ...newAssignment,
        calories: selectedVariant.calories,
        protein: selectedVariant.protein,
        carbs: selectedVariant.carbs,
        fat: selectedVariant.fat,
        serving_size: selectedVariant.serving_size,
        serving_unit: selectedVariant.serving_unit,
        images: usableFoodImages(food.images),
        brand: displayBrand(food.brand),
      };
      setExtendedAssignments((prev) => [...prev, extendedAssignment]);
    }

    setIsFoodUnitSelectorOpen(false);
    setSelectedFood(null);
  };

  // Drag to reorder within a day's meal. Rows are identified by their index
  // in the whole list, and one move applied to both index-aligned lists keeps
  // every other day and meal in its place. The server numbers items in the
  // order they are saved, and the plan adds them to the diary in that order.
  const reorderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const handleReorder = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = Number(active.id);
    const to = Number(over.id);
    setAssignments((prev) => arrayMove(prev, from, to));
    setExtendedAssignments((prev) => arrayMove(prev, from, to));
  };

  const handleRemoveAssignment = (index: number) => {
    setAssignments((prev) => prev.filter((_, i) => i !== index));
    setExtendedAssignments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCopyDay = (toDays: number[]) => {
    if (copySourceDay === null) return;
    const fromDay = copySourceDay;
    const previousAssignments = assignments;
    const previousExtended = extendedAssignments;
    setAssignments(copyDayAssignments(assignments, fromDay, toDays));
    setExtendedAssignments(
      copyDayAssignments(extendedAssignments, fromDay, toDays)
    );
    setCopySourceDay(null);
    toast({
      title: t(
        'mealPlanTemplateForm.dayCopied',
        'Copied {{day}} to {{count}} days',
        {
          day: daysOfWeek[fromDay],
          count: toDays.length,
        }
      ),
      action: (
        <ToastAction
          altText={t('mealPlanTemplateForm.undoCopy', 'Undo')}
          onClick={() => {
            setAssignments(previousAssignments);
            setExtendedAssignments(previousExtended);
          }}
        >
          {t('mealPlanTemplateForm.undoCopy', 'Undo')}
        </ToastAction>
      ),
    });
  };

  const handleEditAssignment = async (index: number) => {
    const assignment = extendedAssignments[index];
    if (!assignment) return;

    setEditingAssignmentIndex(index);

    if (assignment.item_type === 'meal' && assignment.meal_id) {
      try {
        const meal = await queryClient.fetchQuery(
          mealViewOptions(assignment.meal_id)
        );
        setSelectedMeal(meal);
        setIsMealUnitSelectorOpen(true);
      } catch (err) {
        error(loggingLevel, 'Failed to fetch meal for editing:', err);
      }
    } else if (assignment.item_type === 'food' && assignment.food_id) {
      try {
        const food = await queryClient.fetchQuery(
          foodViewOptions(assignment.food_id)
        );
        setSelectedFood(food);
        setIsFoodUnitSelectorOpen(true);
      } catch (err) {
        error(loggingLevel, 'Failed to fetch food for editing:', err);
      }
    }
  };

  // Calculate nutrition totals for a specific meal type on a specific day
  const calculateMealTypeNutrition = (dayIndex: number, mealType: string) => {
    const relevantAssignments = extendedAssignments.filter(
      (a) =>
        a.day_of_week === dayIndex &&
        a.meal_type.toLowerCase() === mealType.toLowerCase()
    );

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    relevantAssignments.forEach((assignment) => {
      // Meals scale by quantity / (serving size × total servings). Foods leave
      // total servings unset, so that factor is 1. A row logged in ounces is
      // converted into a gram or ounce serving before that division.
      const scaled = scaleAssignmentNutrition(assignment);
      totalCalories += scaled.calories;
      totalProtein += scaled.protein;
      totalCarbs += scaled.carbs;
      totalFat += scaled.fat;
    });

    return { totalCalories, totalProtein, totalCarbs, totalFat };
  };

  // Calculate total nutrition for an entire day
  const calculateDailyNutrition = (dayIndex: number) => {
    const relevantAssignments = extendedAssignments.filter(
      (a) => a.day_of_week === dayIndex
    );

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    relevantAssignments.forEach((assignment) => {
      const scaled = scaleAssignmentNutrition(assignment);
      totalCalories += scaled.calories;
      totalProtein += scaled.protein;
      totalCarbs += scaled.carbs;
      totalFat += scaled.fat;
    });

    return { totalCalories, totalProtein, totalCarbs, totalFat };
  };

  const handleSave = () => {
    if (!planName.trim()) {
      toast({
        title: t('common.error'),
        description: t('mealPlanTemplateForm.planNameEmptyError'),
        variant: 'destructive',
      });
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      toast({
        title: t('common.error'),
        description: t('mealPlanTemplateForm.endDateError'),
        variant: 'destructive',
      });
      return;
    }
    const dataToSave = {
      ...template,
      plan_name: planName,
      description,
      start_date: startDate,
      end_date: endDate,
      is_active: isActive,
      auto_log: autoLog,
      assignments,
    };
    debug(
      loggingLevel,
      'MealPlanTemplateForm: Saving template data:',
      dataToSave
    ); // Use debug
    onSave(dataToSave);
  };

  const daysOfWeek = [
    t('common.sunday', 'Sunday'),
    t('common.monday', 'Monday'),
    t('common.tuesday', 'Tuesday'),
    t('common.wednesday', 'Wednesday'),
    t('common.thursday', 'Thursday'),
    t('common.friday', 'Friday'),
    t('common.saturday', 'Saturday'),
  ];
  const mealTypes =
    availableMealTypes.length > 0
      ? availableMealTypes.map((mt) => mt.name)
      : [
          t('common.breakfast', 'breakfast'),
          t('common.lunch', 'lunch'),
          t('common.dinner', 'dinner'),
          t('common.snacks', 'snacks'),
        ];

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {template
                ? t('mealPlanTemplateForm.editTitle')
                : t('mealPlanTemplateForm.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {template
                ? t('mealPlanTemplateForm.editDescription')
                : t('mealPlanTemplateForm.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="planName">
                {t('mealPlanTemplateForm.planNameLabel')}
              </Label>
              <Input
                id="planName"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                {t('mealPlanTemplateForm.descriptionLabel')}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">
                  {t('mealPlanTemplateForm.startDateLabel')}
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">
                  {t('mealPlanTemplateForm.endDateLabel')}
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <Label htmlFor="isActive">
                  {t('mealPlanTemplateForm.setActiveLabel')}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                {t(
                  'mealPlanTemplateForm.multipleActiveHint',
                  'Multiple meal plans can be active at the same time. Active plans automatically populate diary entries.'
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label id="mealPlanAutoLogLabel">
                {t('mealPlanTemplateForm.autoLogLabel', 'Add to diary')}
              </Label>
              <RadioGroup
                aria-labelledby="mealPlanAutoLogLabel"
                value={autoLog ? 'auto' : 'planned'}
                onValueChange={(value) => setAutoLog(value === 'auto')}
              >
                <Label
                  htmlFor="autoLogPlanned"
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 hover:bg-muted"
                >
                  <RadioGroupItem value="planned" id="autoLogPlanned" />
                  <span>
                    {t('mealPlanTemplateForm.autoLogPlanned', 'I add them')}
                    <span className="block text-sm font-normal text-muted-foreground">
                      {t(
                        'mealPlanTemplateForm.autoLogPlannedHint',
                        'Items show as Planned each day.'
                      )}
                    </span>
                  </span>
                </Label>
                <Label
                  htmlFor="autoLogAuto"
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 hover:bg-muted"
                >
                  <RadioGroupItem value="auto" id="autoLogAuto" />
                  <span>
                    {t('mealPlanTemplateForm.autoLogAuto', 'Automatically')}
                    <span className="block text-sm font-normal text-muted-foreground">
                      {t(
                        'mealPlanTemplateForm.autoLogAutoHint',
                        'Each day is filled in ahead of time.'
                      )}
                    </span>
                  </span>
                </Label>
              </RadioGroup>
            </div>
            <div className="space-y-4">
              {daysOfWeek.map((day, dayIndex) => {
                const dailyTotals = calculateDailyNutrition(dayIndex);
                const hasDailyAssignments = extendedAssignments.some(
                  (a) => a.day_of_week === dayIndex
                );

                return (
                  <div key={dayIndex}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold">{day}</h3>
                      {hasDailyAssignments && (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={
                            extendedAssignments.length !== assignments.length
                          }
                          onClick={() => setCopySourceDay(dayIndex)}
                          aria-label={t(
                            'mealPlanTemplateForm.copyDayNamed',
                            'Copy to… ({{day}})',
                            { day }
                          )}
                        >
                          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                          {extendedAssignments.length !== assignments.length
                            ? t('common.loading', 'Loading…')
                            : t('mealPlanTemplateForm.copyDay', 'Copy to…')}
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {mealTypes.map((mealType) => {
                        const mealTypeTotals = calculateMealTypeNutrition(
                          dayIndex,
                          mealType
                        );
                        const assignmentsForMealType =
                          extendedAssignments.filter(
                            (a) =>
                              a.day_of_week === dayIndex &&
                              a.meal_type.toLowerCase() ===
                                mealType.toLowerCase()
                          );

                        return (
                          <div key={mealType} className="p-4 border rounded-lg">
                            <h4 className="font-semibold capitalize">
                              {mealType}
                            </h4>
                            <DndContext
                              sensors={reorderSensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleReorder}
                            >
                              <SortableContext
                                items={assignmentsForMealType.map(
                                  (assignment) =>
                                    String(
                                      extendedAssignments.indexOf(assignment)
                                    )
                                )}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="space-y-2 mt-2">
                                  {assignmentsForMealType.map((assignment) => {
                                    const actualIndex =
                                      extendedAssignments.indexOf(assignment);
                                    const itemName =
                                      assignment.item_type === 'meal'
                                        ? assignment.meal_name
                                        : assignment.food_name;
                                    const { calories, protein, carbs, fat } =
                                      scaleAssignmentNutrition(assignment);
                                    const images = usableFoodImages(
                                      assignment.images
                                    );
                                    const image = images[0] ?? null;

                                    return (
                                      <SortableRow
                                        key={actualIndex}
                                        id={String(actualIndex)}
                                        handleLabel={t(
                                          'mealPlanTemplateForm.reorder',
                                          'Reorder {{name}}',
                                          { name: itemName ?? '' }
                                        )}
                                        // Nutrition still loading: the two lists
                                        // are not aligned yet.
                                        disabled={
                                          extendedAssignments.length !==
                                          assignments.length
                                        }
                                      >
                                        {(handle) => (
                                          <div className="flex items-start gap-3 rounded-md border bg-gray-50 p-3 dark:bg-gray-800">
                                            {image && (
                                              <button
                                                type="button"
                                                className="flex-shrink-0 self-center rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                                onClick={() =>
                                                  openLightbox(
                                                    images,
                                                    0,
                                                    itemName ?? undefined
                                                  )
                                                }
                                                aria-label={t(
                                                  'food.viewImages',
                                                  'View images'
                                                )}
                                              >
                                                <img
                                                  src={image}
                                                  alt={itemName ?? ''}
                                                  className="h-16 w-16 rounded-md object-cover"
                                                  loading="lazy"
                                                  onError={(e) => {
                                                    const button =
                                                      e.currentTarget
                                                        .parentElement;
                                                    if (button) {
                                                      button.style.display =
                                                        'none';
                                                    }
                                                  }}
                                                />
                                              </button>
                                            )}
                                            <div className="min-w-0 flex-1 space-y-2">
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                  <span className="font-medium">
                                                    {itemName}
                                                  </span>
                                                  {assignment.brand ? (
                                                    <Badge
                                                      variant="secondary"
                                                      className="text-xs"
                                                    >
                                                      {assignment.brand}
                                                    </Badge>
                                                  ) : null}
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1">
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-11 w-11"
                                                    onClick={() =>
                                                      handleEditAssignment(
                                                        actualIndex
                                                      )
                                                    }
                                                    title={t(
                                                      'mealPlanTemplateForm.editQuantity',
                                                      'Edit quantity'
                                                    )}
                                                    aria-label={t(
                                                      'mealPlanTemplateForm.editQuantity',
                                                      'Edit quantity'
                                                    )}
                                                  >
                                                    <Edit className="h-4 w-4" />
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-11 w-11"
                                                    onClick={() =>
                                                      handleRemoveAssignment(
                                                        actualIndex
                                                      )
                                                    }
                                                    title={t(
                                                      'mealPlanTemplateForm.remove',
                                                      'Remove'
                                                    )}
                                                    aria-label={t(
                                                      'mealPlanTemplateForm.remove',
                                                      'Remove'
                                                    )}
                                                  >
                                                    <X className="h-4 w-4" />
                                                  </Button>
                                                  {assignmentsForMealType.length >
                                                    1 && (
                                                    <span className="ml-1 inline-flex">
                                                      {handle}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="flex flex-col sm:flex-row justify-between text-sm text-muted-foreground">
                                                <div>
                                                  {assignment.quantity || 1}{' '}
                                                  {assignment.unit ||
                                                    t(
                                                      'mealPlanTemplateForm.serving',
                                                      'serving'
                                                    )}
                                                </div>
                                                <div className="flex space-x-3 mt-1 sm:mt-0">
                                                  <span>
                                                    {calories.toFixed(0)} kcal
                                                  </span>
                                                  <span className="text-blue-500">
                                                    {t(
                                                      'mealPlanTemplateForm.pProteing',
                                                      'P: {{protein}}g',
                                                      {
                                                        protein:
                                                          protein.toFixed(1),
                                                      }
                                                    )}
                                                  </span>
                                                  <span className="text-green-500">
                                                    {t(
                                                      'mealPlanTemplateForm.cCarbsg',
                                                      'C: {{carbs}}g',
                                                      {
                                                        carbs: carbs.toFixed(1),
                                                      }
                                                    )}
                                                  </span>
                                                  <span className="text-yellow-500">
                                                    {t(
                                                      'mealPlanTemplateForm.fFatg',
                                                      'F: {{fat}}g',
                                                      { fat: fat.toFixed(1) }
                                                    )}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </SortableRow>
                                    );
                                  })}
                                </div>
                              </SortableContext>
                            </DndContext>
                            {assignmentsForMealType.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                                <Trans
                                  i18nKey="mealPlanTemplateForm.totalKcalPGC"
                                  defaults={
                                    '<strong>Total:</strong> {{totalCalories}} kcal | P: {{totalProtein}}g | C: {{totalCarbs}}g | F: {{totalFat}}g'
                                  }
                                  values={{
                                    totalCalories:
                                      mealTypeTotals.totalCalories.toFixed(0),
                                    totalProtein:
                                      mealTypeTotals.totalProtein.toFixed(1),
                                    totalCarbs:
                                      mealTypeTotals.totalCarbs.toFixed(1),
                                    totalFat:
                                      mealTypeTotals.totalFat.toFixed(1),
                                  }}
                                  components={{ strong: <strong /> }}
                                />
                              </div>
                            )}
                            <div className="flex space-x-2 mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleAddFood(dayIndex, mealType)
                                }
                              >
                                {t('mealPlanTemplateForm.addFoodOrMealButton')}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {hasDailyAssignments && (
                      <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <h4 className="font-semibold text-sm mb-2">
                          {t('mealPlanTemplateForm.dailyTotal', {
                            day,
                            defaultValue: `Daily Total for ${day}`,
                          })}
                        </h4>
                        <div className="text-sm space-x-4">
                          <span className="font-medium">
                            {dailyTotals.totalCalories.toFixed(0)} kcal
                          </span>
                          <span className="text-blue-500">
                            {t(
                              'mealPlanTemplateForm.pTotalProteing',
                              'P: {{totalProtein}}g',
                              {
                                totalProtein:
                                  dailyTotals.totalProtein.toFixed(1),
                              }
                            )}
                          </span>
                          <span className="text-green-500">
                            {t(
                              'mealPlanTemplateForm.cTotalCarbsg',
                              'C: {{totalCarbs}}g',
                              { totalCarbs: dailyTotals.totalCarbs.toFixed(1) }
                            )}
                          </span>
                          <span className="text-yellow-500">
                            {t(
                              'mealPlanTemplateForm.fTotalFatg',
                              'F: {{totalFat}}g',
                              { totalFat: dailyTotals.totalFat.toFixed(1) }
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave}>{t('common.saveChanges')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageLightbox {...lightboxProps} />

      <FoodSearchDialog
        open={isFoodSelectionOpen}
        onOpenChange={setIsFoodSelectionOpen}
        onFoodSelect={(item, type) => handleFoodSelected(item, type)}
        title={t('mealPlanTemplateForm.addFoodToMealPlanTitle')}
        description={t('mealPlanTemplateForm.addFoodToMealPlanDescription')}
      />

      {selectedFood && (
        <FoodUnitSelector
          food={selectedFood}
          open={isFoodUnitSelectorOpen}
          onOpenChange={setIsFoodUnitSelectorOpen}
          onSelect={handleFoodUnitSelected}
        />
      )}

      <CopyDayDialog
        fromDay={copySourceDay}
        dayNames={daysOfWeek}
        itemCounts={countAssignmentsByDay(assignments)}
        onCopy={handleCopyDay}
        onClose={() => setCopySourceDay(null)}
      />

      {selectedMeal && (
        <MealUnitSelector
          key={`${selectedMeal?.id}-${isMealUnitSelectorOpen}`}
          meal={selectedMeal}
          open={isMealUnitSelectorOpen}
          onOpenChange={setIsMealUnitSelectorOpen}
          onSelect={handleMealUnitSelected}
        />
      )}
    </>
  );
};

export default MealPlanTemplateForm;
