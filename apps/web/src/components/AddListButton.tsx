// apps/web/src/components/AddListButton.tsx
'use client';

import { useState } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { Plus } from 'lucide-react';
import { useT } from '@/lib/i18n';

const C = {
  surface: '#14171c',
  hover:   '#1c2128',
  border:  '#1f2329',
  border2: '#2a2f36',
  text:    '#e6e8eb',
  text2:   '#a1a7b0',
  text3:   '#6b7280',
  text4:   '#4b5260',
  accent:  '#3b82f6',
};

interface AddListButtonProps {
  boardId: string;
}

export default function AddListButton({ boardId }: AddListButtonProps) {
  const { createList, isLoading } = useBoardStore();
  const t = useT();
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
      <div style={{ width: '220px', flexShrink: 0 }}>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 w-full transition-colors"
          style={{
            padding: '10px 14px', borderRadius: '10px', fontSize: '13px',
            color: C.text4, background: 'rgba(255,255,255,0.03)',
            border: `1px dashed ${C.border}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget.style.borderColor = C.accent);
            (e.currentTarget.style.color = C.accent);
            (e.currentTarget.style.background = `rgba(59,130,246,0.06)`);
          }}
          onMouseLeave={(e) => {
            (e.currentTarget.style.borderColor = C.border);
            (e.currentTarget.style.color = C.text4);
            (e.currentTarget.style.background = 'rgba(255,255,255,0.03)');
          }}
        >
          <Plus size={14} /> {t.addlist_btn}
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '272px', flexShrink: 0 }}>
      <div
        style={{
          background: '#12151b', border: `1px solid ${C.accent}`,
          borderRadius: '10px', padding: '12px',
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
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
