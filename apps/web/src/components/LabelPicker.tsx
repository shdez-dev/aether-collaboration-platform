// apps/web/src/components/LabelPicker.tsx
'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useLabelStore, Label } from '@/stores/labelStore';
import '../styles/label-picker.css';

interface LabelPickerProps {
  workspaceId: string;
  cardId: string;
  assignedLabels: Label[];
  onLabelAssigned: (label: Label) => void;
  onLabelRemoved: (labelId: string) => void;
}

// Colores predefinidos
const PRESET_COLORS = [
  { name: 'Frost Blue', hex: '#5e81ac' },
  { name: 'Aurora Green', hex: '#a3be8c' },
  { name: 'Aurora Yellow', hex: '#ebcb8b' },
  { name: 'Aurora Orange', hex: '#d08770' },
  { name: 'Aurora Red', hex: '#bf616a' },
  { name: 'Aurora Purple', hex: '#b48ead' },
  { name: 'Snow Storm', hex: '#d8dee9' },
  { name: 'Polar Night', hex: '#4c566a' },
];

const LabelItem = memo(function LabelItem({
  label,
  isAssigned,
  onToggle,
}: {
  label: Label;
  isAssigned: boolean;
  onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="label-item" type="button">
      <div className="label-color-preview" style={{ backgroundColor: label.color }} />
      <span className="label-item-name">{label.name}</span>
      <div className={`label-checkbox ${isAssigned ? 'label-checkbox-checked' : ''}`}>
        {isAssigned && <span>✓</span>}
      </div>
    </button>
  );
});

export function LabelPicker({
  workspaceId,
  cardId,
  assignedLabels,
  onLabelAssigned,
  onLabelRemoved,
}: LabelPickerProps) {
  const { accessToken } = useAuthStore();
  const { getWorkspaceLabels, fetchLabels, createLabel } = useLabelStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex);
  const [searchQuery, setSearchQuery] = useState('');

  const workspaceLabels = getWorkspaceLabels(workspaceId);
  const assignedLabelIds = new Set(assignedLabels.map((l) => l.id));

  useEffect(() => {
    if (workspaceLabels.length === 0) {
      fetchLabels(workspaceId);
    }
  }, [workspaceId]);

  const handleAssignLabel = useCallback(
    async (label: Label) => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/cards/${cardId}/labels`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ labelId: label.id }),
          }
        );

        if (!response.ok) throw new Error('Failed to assign label');
        onLabelAssigned(label);
      } catch (error: any) {
        alert(`Failed to assign label: ${error.message}`);
      }
    },
    [cardId, accessToken, onLabelAssigned]
  );

  const handleRemoveLabel = useCallback(
    async (labelId: string) => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/cards/${cardId}/labels/${labelId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) throw new Error('Failed to remove label');
        onLabelRemoved(labelId);
      } catch (error: any) {
        alert(`Failed to remove label: ${error.message}`);
      }
    },
    [cardId, accessToken, onLabelRemoved]
  );

  const handleToggleLabel = (label: Label) => {
    if (assignedLabelIds.has(label.id)) {
      handleRemoveLabel(label.id);
    } else {
      handleAssignLabel(label);
    }
  };

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;

    try {
      const newLabel = await createLabel(workspaceId, {
        name: newLabelName.trim(),
        color: selectedColor,
      });

      await handleAssignLabel(newLabel);

      setNewLabelName('');
      setSelectedColor(PRESET_COLORS[0].hex);
      setIsCreating(false);
    } catch (error: any) {
      alert(`Failed to create label: ${error.message}`);
    }
  };

  const filteredLabels = workspaceLabels.filter((label) =>
    label.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="label-picker-permanent">
      {/* Assigned Labels */}
      {assignedLabels.length > 0 && (
        <div className="assigned-labels-section">
          <div className="assigned-labels-display">
            {assignedLabels.map((label) => (
              <div
                key={label.id}
                className="assigned-label-chip"
                style={{ backgroundColor: label.color }}
              >
                <span>{label.name}</span>
                <button
                  onClick={() => handleRemoveLabel(label.id)}
                  className="assigned-label-remove"
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      {!isCreating && (
        <input
          type="text"
          placeholder="Search labels..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="label-search-input"
        />
      )}

      {/* Content */}
      <div className="label-content">
        {isCreating ? (
          <form onSubmit={handleCreateLabel} className="create-label-form">
            <div className="form-group">
              <label>Label name</label>
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="e.g. Bug, Feature..."
                className="label-name-input"
                autoFocus
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label>Color</label>
              <div className="color-picker-grid">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setSelectedColor(color.hex)}
                    className={`color-option ${selectedColor === color.hex ? 'color-option-selected' : ''}`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  >
                    {selectedColor === color.hex && <span>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewLabelName('');
                  setSelectedColor(PRESET_COLORS[0].hex);
                }}
                className="btn-cancel-create"
              >
                Cancel
              </button>
              <button type="submit" disabled={!newLabelName.trim()} className="btn-create-label">
                Create
              </button>
            </div>
          </form>
        ) : (
          <>
            {filteredLabels.length === 0 ? (
              <div className="empty-state">
                <p>No labels yet</p>
              </div>
            ) : (
              <div className="labels-list">
                {filteredLabels.map((label) => (
                  <LabelItem
                    key={label.id}
                    label={label}
                    isAssigned={assignedLabelIds.has(label.id)}
                    onToggle={() => handleToggleLabel(label)}
                  />
                ))}
              </div>
            )}

            <button onClick={() => setIsCreating(true)} className="btn-new-label" type="button">
              <span>+</span>
              Create new label
            </button>
          </>
        )}
      </div>
    </div>
  );
}
