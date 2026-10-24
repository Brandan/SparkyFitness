import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableRowProps {
  id: string;
  /** Accessible name for the handle, e.g. "Reorder Oatmeal". */
  handleLabel: string;
  disabled?: boolean;
  /** Renders the row; place `handle` where the grip should appear. */
  children: (handle: ReactNode) => ReactNode;
}

/**
 * One draggable row in a sortable list (a diary meal, a meal plan's meal).
 * Use inside a dnd-kit SortableContext. Only the grip starts a drag, so clicks
 * and text selection elsewhere in the row behave as before. The grip also
 * works from the keyboard: focus it, press Space, move with the arrow keys,
 * press Space again to drop (Escape cancels).
 */
const SortableRow = ({
  id,
  handleLabel,
  disabled = false,
  children,
}: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={handleLabel}
      title={handleLabel}
      disabled={disabled}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      )}
    >
      <GripVertical className="h-5 w-5" aria-hidden="true" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        // Translate, not Transform: rows differ in height and must not stretch.
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        'relative',
        isDragging && 'z-10 rounded-lg opacity-90 shadow-lg ring-2 ring-primary'
      )}
    >
      {children(handle)}
    </div>
  );
};

export default SortableRow;
