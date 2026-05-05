'use client';

import { X, Filter } from 'lucide-react';
import { EVENT_CATEGORIES } from '@/lib/utils/activityLog';
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
  accentColor?: string;
}

// Map category keys to their i18n translation key
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  workspace: 'activity_cat_workspace',
  board: 'activity_cat_board',
  card: 'activity_cat_card',
  document: 'activity_cat_document',
  comment: 'activity_cat_comment',
};

const C = {
  bg:      '#0b0d10',
  bg2:     '#0f1217',
  surface: '#14171c',
  hover:   '#1c2128',
  border:  '#1f2329',
  border2: '#2a2f36',
  text:    '#e6e8eb',
  text2:   '#a1a7b0',
  text3:   '#6b7280',
  text4:   '#4b5260',
  accent:  '#3b82f6',
  green:   '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  purple:  '#a855f7',
};

export function ActivityFiltersComponent({
  filters,
  onChange,
  users = [],
  boards = [],
  accentColor = '#3b82f6',
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

  const selectStyle: React.CSSProperties = {
    background: C.bg2,
    border: `1px solid ${C.border}`,
    color: C.text,
    borderRadius: '6px',
    padding: '7px 10px',
    width: '100%',
    fontSize: '12px',
    outline: 'none',
  };

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2">
          <div style={{ padding: '6px', background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: '6px' }}>
            <Filter style={{ width: '14px', height: '14px', color: accentColor }} />
          </div>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>{t.activity_filter_title}</h3>
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1"
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 500,
              color: C.red,
              background: `${C.red}12`,
              border: `1px solid ${C.red}44`,
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <X style={{ width: '11px', height: '11px' }} />
            {t.activity_filter_clear}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Categories */}
        <div>
          <p
            className="uppercase tracking-wide mb-3"
            style={{ fontSize: '10px', fontWeight: 600, color: C.text3 }}
          >
            {t.activity_filter_categories}
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(EVENT_CATEGORIES).map(([key, category]) => {
              const categoryEvents = category.events;
              const isSelected = categoryEvents.some((e) => filters.eventTypes.includes(e));
              const allSelected = categoryEvents.every((e) => filters.eventTypes.includes(e));
              const labelKey = CATEGORY_LABEL_KEYS[key];
              const label = labelKey ? ((t as unknown as Record<string, string>)[labelKey]) : category.label;

              let pillStyle: React.CSSProperties;
              if (allSelected) {
                pillStyle = {
                  background: `${accentColor}22`,
                  color: accentColor,
                  border: `1px solid ${accentColor}44`,
                };
              } else if (isSelected) {
                pillStyle = {
                  background: `${accentColor}14`,
                  color: accentColor,
                  border: `1px solid ${accentColor}33`,
                };
              } else {
                pillStyle = {
                  background: C.hover,
                  color: C.text2,
                  border: `1px solid ${C.border}`,
                };
              }

              return (
                <button
                  key={key}
                  onClick={() => handleCategoryChange(key)}
                  style={{
                    ...pillStyle,
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 500,
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <p
            className="uppercase tracking-wide mb-3"
            style={{ fontSize: '10px', fontWeight: 600, color: C.text3 }}
          >
            {t.activity_filter_date_range}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <label htmlFor="startDate" style={{ display: 'block', fontSize: '11px', color: C.text3, marginBottom: '5px' }}>
                {t.activity_filter_date_from}
              </label>
              <input
                id="startDate"
                type="date"
                value={filters.startDate ?? ''}
                max={filters.endDate ?? ''}
                onChange={(e) => onChange({ ...filters, startDate: e.target.value || undefined })}
                style={{ ...selectStyle, colorScheme: 'dark', cursor: 'pointer' }}
              />
            </div>
            <div>
              <label htmlFor="endDate" style={{ display: 'block', fontSize: '11px', color: C.text3, marginBottom: '5px' }}>
                {t.activity_filter_date_to}
              </label>
              <input
                id="endDate"
                type="date"
                value={filters.endDate ?? ''}
                min={filters.startDate ?? ''}
                onChange={(e) => onChange({ ...filters, endDate: e.target.value || undefined })}
                style={{ ...selectStyle, colorScheme: 'dark', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* User Filter */}
        {users.length > 0 && (
          <div>
            <label
              htmlFor="userId"
              className="block mb-3 uppercase tracking-wide"
              style={{ fontSize: '10px', fontWeight: 600, color: C.text3 }}
            >
              {t.activity_filter_user}
            </label>
            <select
              id="userId"
              value={filters.userId || ''}
              onChange={(e) => onChange({ ...filters, userId: e.target.value || undefined })}
              style={selectStyle}
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
              className="block mb-3 uppercase tracking-wide"
              style={{ fontSize: '10px', fontWeight: 600, color: C.text3 }}
            >
              Board
            </label>
            <select
              id="boardId"
              value={filters.boardId || ''}
              onChange={(e) => onChange({ ...filters, boardId: e.target.value || undefined })}
              style={selectStyle}
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
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <p className="mb-2" style={{ fontSize: '11px', color: C.text3 }}>
            {t.activity_filter_active}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {filters.eventTypes.length > 0 && (
              <span
                className="inline-flex items-center"
                style={{
                  padding: '2px 8px',
                  background: `${accentColor}18`,
                  border: `1px solid ${accentColor}33`,
                  color: accentColor,
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: '4px',
                }}
              >
                {t.activity_filter_types(filters.eventTypes.length)}
              </span>
            )}
            {(filters.startDate || filters.endDate) && (
              <span
                className="inline-flex items-center"
                style={{
                  padding: '2px 8px',
                  background: `${C.green}18`,
                  border: `1px solid ${C.green}33`,
                  color: C.green,
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: '4px',
                }}
              >
                {t.activity_filter_dates}
              </span>
            )}
            {filters.userId && (
              <span
                className="inline-flex items-center"
                style={{
                  padding: '2px 8px',
                  background: `${C.amber}18`,
                  border: `1px solid ${C.amber}33`,
                  color: C.amber,
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: '4px',
                }}
              >
                {t.activity_filter_user}
              </span>
            )}
            {filters.boardId && (
              <span
                className="inline-flex items-center"
                style={{
                  padding: '2px 8px',
                  background: `${C.purple}18`,
                  border: `1px solid ${C.purple}33`,
                  color: C.purple,
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: '4px',
                }}
              >
                Board
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
