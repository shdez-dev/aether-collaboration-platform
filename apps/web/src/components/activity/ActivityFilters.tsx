'use client';

import { X, Filter } from 'lucide-react';
import { EVENT_CATEGORIES } from '@/lib/utils/activityLog';
import { DatePicker } from '@/components/ui/date-picker';
import { useT } from '@/lib/i18n';

export interface ActivityFilters {
  eventTypes: string[];
  startDate?: string;
  endDate?: string;
  userId?: string;
  boardId?: string;
}

interface ActivityFiltersProps {
  filters: ActivityFilters;
  onChange: (filters: ActivityFilters) => void;
  users?: Array<{ id: string; name: string }>;
  boards?: Array<{ id: string; name: string }>;
}

// Map category keys to their i18n translation key
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  workspace: 'activity_cat_workspace',
  board: 'activity_cat_board',
  card: 'activity_cat_card',
  document: 'activity_cat_document',
  comment: 'activity_cat_comment',
};

export function ActivityFiltersComponent({
  filters,
  onChange,
  users = [],
  boards = [],
}: ActivityFiltersProps) {
  const t = useT();

  const handleCategoryChange = (category: string) => {
    const categoryEvents =
      EVENT_CATEGORIES[category as keyof typeof EVENT_CATEGORIES]?.events || [];
    const allSelected = categoryEvents.every((e) => filters.eventTypes.includes(e));

    if (allSelected) {
      onChange({
        ...filters,
        eventTypes: filters.eventTypes.filter((e) => !categoryEvents.includes(e)),
      });
    } else {
      onChange({
        ...filters,
        eventTypes: [...new Set([...filters.eventTypes, ...categoryEvents])],
      });
    }
  };

  const handleClearFilters = () => {
    onChange({
      eventTypes: [],
      startDate: undefined,
      endDate: undefined,
      userId: undefined,
      boardId: undefined,
    });
  };

  const hasActiveFilters =
    filters.eventTypes.length > 0 ||
    filters.startDate ||
    filters.endDate ||
    filters.userId ||
    filters.boardId;

  return (
    <div className="bg-card border border-border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-accent/10 border border-accent/30">
            <Filter className="h-4 w-4 text-accent" />
          </div>
          <h3 className="text-sm font-bold text-text-primary">{t.activity_filter_title}</h3>
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10 transition-colors flex items-center gap-1 border border-error/30 hover:border-error"
          >
            <X className="h-3 w-3" />
            {t.activity_filter_clear}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Categories */}
        <div>
          <p className="text-xs font-medium text-text-muted mb-3 uppercase tracking-wide">
            {t.activity_filter_categories}
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(EVENT_CATEGORIES).map(([key, category]) => {
              const categoryEvents = category.events;
              const isSelected = categoryEvents.some((e) => filters.eventTypes.includes(e));
              const allSelected = categoryEvents.every((e) => filters.eventTypes.includes(e));
              const labelKey = CATEGORY_LABEL_KEYS[key];
              const label = labelKey ? ((t as unknown as Record<string, string>)[labelKey]) : category.label;

              return (
                <button
                  key={key}
                  onClick={() => handleCategoryChange(key)}
                  className={`px-3 py-2 text-xs font-medium transition-colors border ${
                    allSelected
                      ? 'bg-accent text-white border-accent'
                      : isSelected
                        ? 'bg-accent/20 text-accent border-accent/50'
                        : 'bg-surface text-text-secondary border-border hover:bg-card hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <p className="text-xs font-medium text-text-muted mb-3 uppercase tracking-wide">
            {t.activity_filter_date_range}
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="startDate" className="text-xs text-text-muted block mb-1.5">
                {t.activity_filter_date_from}
              </label>
              <DatePicker
                date={filters.startDate ? new Date(filters.startDate) : undefined}
                onDateChange={(date) =>
                  onChange({
                    ...filters,
                    startDate: date ? date.toISOString().split('T')[0] : undefined,
                  })
                }
                placeholder={t.activity_filter_date_from_placeholder}
                maxDate={filters.endDate ? new Date(filters.endDate) : undefined}
              />
            </div>
            <div>
              <label htmlFor="endDate" className="text-xs text-text-muted block mb-1.5">
                {t.activity_filter_date_to}
              </label>
              <DatePicker
                date={filters.endDate ? new Date(filters.endDate) : undefined}
                onDateChange={(date) =>
                  onChange({
                    ...filters,
                    endDate: date ? date.toISOString().split('T')[0] : undefined,
                  })
                }
                placeholder={t.activity_filter_date_to_placeholder}
                minDate={filters.startDate ? new Date(filters.startDate) : undefined}
              />
            </div>
          </div>
        </div>

        {/* User Filter */}
        {users.length > 0 && (
          <div>
            <label
              htmlFor="userId"
              className="text-xs font-medium text-text-muted block mb-3 uppercase tracking-wide"
            >
              {t.activity_filter_user}
            </label>
            <select
              id="userId"
              value={filters.userId || ''}
              onChange={(e) => onChange({ ...filters, userId: e.target.value || undefined })}
              className="input-terminal text-xs w-full"
            >
              <option value="">{t.activity_filter_user_all}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Board Filter */}
        {boards.length > 0 && (
          <div>
            <label
              htmlFor="boardId"
              className="text-xs font-medium text-text-muted block mb-3 uppercase tracking-wide"
            >
              Board
            </label>
            <select
              id="boardId"
              value={filters.boardId || ''}
              onChange={(e) => onChange({ ...filters, boardId: e.target.value || undefined })}
              className="input-terminal text-xs w-full"
            >
              <option value="">{t.activity_filter_board_all}</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-text-muted mb-2">{t.activity_filter_active}</p>
          <div className="flex flex-wrap gap-1.5">
            {filters.eventTypes.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 bg-accent/10 border border-accent/30 text-accent text-xs font-medium">
                {t.activity_filter_types(filters.eventTypes.length)}
              </span>
            )}
            {(filters.startDate || filters.endDate) && (
              <span className="inline-flex items-center px-2 py-0.5 bg-success/10 border border-success/30 text-success text-xs font-medium">
                {t.activity_filter_dates}
              </span>
            )}
            {filters.userId && (
              <span className="inline-flex items-center px-2 py-0.5 bg-warning/10 border border-warning/30 text-warning text-xs font-medium">
                {t.activity_filter_user}
              </span>
            )}
            {filters.boardId && (
              <span className="inline-flex items-center px-2 py-0.5 bg-info/10 border border-info/30 text-info text-xs font-medium">
                Board
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
