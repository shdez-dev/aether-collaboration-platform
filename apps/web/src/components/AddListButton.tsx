// apps/web/src/components/AddListButton.tsx
'use client';

import { useState } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { Plus } from 'lucide-react';
import { es } from '@/lib/i18n';
import { C } from '@/lib/colors';


interface AddListButtonProps {
  boardId: string;
}

export default function AddListButton({ boardId }: AddListButtonProps) {
  const { createList, isLoading } = useBoardStore();
  const t = es;
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setIsCreating(false); setName(''); return; }
    await createList(boardId, name.trim());
    setName(''); setIsCreating(false);
  };

  const handleCancel = () => { setName(''); setIsCreating(false); };

  if (!isCreating) {
    return (
      <div style={{ width: 'min(304px, calc(100vw - 48px))', flexShrink: 0 }}>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-3 w-full text-left transition-colors"
          style={{
            minHeight: '76px', padding: '14px', borderRadius: '12px',
            color: C.text2, background: C.bg2,
            border: `1px dashed ${C.border2}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget.style.borderColor = C.accent);
            (e.currentTarget.style.color = C.accent);
            (e.currentTarget.style.background = C.surface);
          }}
          onMouseLeave={(e) => {
            (e.currentTarget.style.borderColor = C.border2);
            (e.currentTarget.style.color = C.text2);
            (e.currentTarget.style.background = C.bg2);
          }}
        >
          <span style={{ width: '30px', height: '30px', flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '8px', background: C.surface }}><Plus size={16} /></span>
          <span style={{ display: 'grid', gap: '3px' }}>
            <strong style={{ fontSize: '12.5px', fontWeight: 700 }}>Añadir lista</strong>
            <small style={{ fontSize: '11px', color: C.text3 }}>Define otra etapa del flujo.</small>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: 'min(304px, calc(100vw - 48px))', flexShrink: 0 }}>
      <div
        style={{
          background: C.bg2, border: `1px solid ${C.accent}`,
          borderRadius: '12px', padding: '14px',
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="new-board-list-name" style={{ fontSize: '12px', fontWeight: 700, color: C.text }}>Nueva lista</label>
          <input
            id="new-board-list-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleCancel(); }}
            placeholder={t.addlist_placeholder}
            maxLength={255}
            disabled={isLoading}
            autoFocus
            style={{
              background: C.surface, border: `1px solid ${C.border2}`,
              borderRadius: '6px', padding: '7px 10px', fontSize: '13px',
              color: C.text, outline: 'none', width: '100%',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = C.border2)}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="submit"
              data-action="save"
              disabled={isLoading || !name.trim()}
              style={{
                flex: 1, padding: '6px 0', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500,
                background: C.accent, color: '#fff', opacity: isLoading || !name.trim() ? 0.5 : 1,
                cursor: isLoading || !name.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? t.addlist_btn_creating : t.addlist_btn_add}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              style={{
                padding: '6px 10px', borderRadius: '6px', fontSize: '12.5px',
                background: C.hover, border: `1px solid ${C.border2}`, color: C.text2,
              }}
            >
              ✕
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
