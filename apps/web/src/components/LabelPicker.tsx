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

// Colores estilo Asana - tonos medios/claros con buena saturación
const PRESET_COLORS = [
  { name: 'Rosa', hex: '#f06292' },
  { name: 'Verde', hex: '#66bb6a' },
  { name: 'Azul', hex: '#42a5f5' },
  { name: 'Rojo', hex: '#ef5350' },
  { name: 'Naranja', hex: '#ff9800' },
  { name: 'Púrpura', hex: '#ab47bc' },
  { name: 'Turquesa', hex: '#26c6da' },
  { name: 'Marrón', hex: '#8d6e63' },
  { name: 'Amarillo', hex: '#ffca28' },
  { name: 'Lima', hex: '#9ccc65' },
  { name: 'Coral', hex: '#ff7043' },
  { name: 'Índigo', hex: '#5c6bc0' },
];

// Función para obtener color de texto - SIEMPRE tonos oscuros/medios
function getTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Usar tonos oscuros/medios según luminosidad
  if (luminance > 0.7) {
    return 'rgba(0, 0, 0, 0.85)'; // Negro casi sólido para muy claros
  } else if (luminance > 0.5) {
    return 'rgba(0, 0, 0, 0.75)'; // Negro medio para claros
  } else if (luminance > 0.3) {
    return 'rgba(255, 255, 255, 0.95)'; // Blanco para medios
  } else {
    return 'rgba(255, 255, 255, 1)'; // Blanco sólido para oscuros
  }
}

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
      <div
        className="label-color-preview-badge"
        style={{
          backgroundColor: label.color,
          color: getTextColor(label.color),
        }}
      >
        {label.name.substring(0, 3).toUpperCase()}
      </div>
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

  // ✅ DEBUG: Ver labels asignadas
  useEffect(() => {
  }, [assignedLabels]);

  useEffect(() => {
    if (workspaceLabels.length === 0) {
      fetchLabels(workspaceId);
    }
  }, [workspaceId]);

  const handleAssignLabel = useCallback(
    async (label: Label) => {
      // ✅ VALIDACIÓN 1: Verificar si ya está asignada localmente
      if (assignedLabelIds.has(label.id)) {
        return;
      }

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

        // ✅ VALIDACIÓN 2: Manejar 409 Conflict (ya existe en BD)
        if (response.status === 409) {
          // Simplemente ignorar, la label ya está asignada
          // Opcionalmente, actualizar el estado local si no está sincronizado
          if (!assignedLabelIds.has(label.id)) {
            onLabelAssigned(label);
          }
          return;
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Error al asignar etiqueta');
        }

        onLabelAssigned(label);
      } catch (error: any) {
        alert(`Error al asignar etiqueta: ${error.message}`);
      }
    },
    [cardId, accessToken, onLabelAssigned, assignedLabelIds]
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

        if (!response.ok) throw new Error('Error al remover etiqueta');
        onLabelRemoved(labelId);
      } catch (error: any) {
        alert(`Error al remover etiqueta: ${error.message}`);
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
      alert(`Error al crear etiqueta: ${error.message}`);
    }
  };

  const filteredLabels = workspaceLabels.filter((label) =>
    label.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="label-picker-permanent">
      {/* Assigned Labels - Estilo Badges */}
      {assignedLabels.length > 0 && (
        <div className="assigned-labels-section">
          <div className="assigned-labels-display">
            {assignedLabels.map((label) => (
              <div
                key={label.id}
                className="assigned-label-badge"
                style={{
                  backgroundColor: label.color,
                  color: getTextColor(label.color),
                }}
              >
                <span className="badge-text">{label.name}</span>
                <button
                  onClick={() => handleRemoveLabel(label.id)}
                  className="badge-remove"
                  style={{ color: getTextColor(label.color) }}
                  type="button"
                  aria-label="Remover etiqueta"
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
          placeholder="Buscar etiquetas..."
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
              <label>Nombre de la etiqueta</label>
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="ej. Error, Feature..."
                className="label-name-input"
                autoFocus
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label>Mi color:</label>
              <div className="color-picker-grid-badges">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setSelectedColor(color.hex)}
                    className={`color-badge-option ${selectedColor === color.hex ? 'color-badge-selected' : ''}`}
                    style={{
                      backgroundColor: color.hex,
                      color: getTextColor(color.hex),
                    }}
                    title={color.name}
                  >
                    {selectedColor === color.hex && <span className="badge-check">✓</span>}
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
                Cancelar
              </button>
              <button type="submit" disabled={!newLabelName.trim()} className="btn-create-label">
                Crear
              </button>
            </div>
          </form>
        ) : (
          <>
            {filteredLabels.length === 0 ? (
              <div className="empty-state">
                <p>Sin etiquetas aún</p>
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
              Crear nueva etiqueta
            </button>
          </>
        )}
      </div>
    </div>
  );
}
