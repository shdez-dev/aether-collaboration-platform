'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTeamStore, type Team } from '@/stores/teamStore';
import { useT } from '@/lib/i18n';
import { Plus, Users, Search } from 'lucide-react';
import { C } from '@/lib/colors';

// ── Color tokens ──────────────────────────────────────────────────────────────

const PALETTE = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899','#06b6d4','#fb923c','#84cc16'];

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'ahora';
  if (mins < 60)  return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 30)  return `hace ${days}d`;
  return `hace ${Math.floor(days / 30)}mes`;
}

function getInitial(name: string | null | undefined) {
  return name?.trim()?.[0]?.toUpperCase() ?? '?';
}

// ── TeamCard ──────────────────────────────────────────────────────────────────

function TeamCard({ team, onClick }: { team: Team; onClick: () => void }) {
  const t = useT();
  const [hov, setHov] = useState(false);
  const color = team.color || C.accent;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="rounded-[8px] cursor-pointer transition-all overflow-hidden flex flex-col"
      style={{
        background: hov ? C.hover : C.surface,
        border: `1px solid ${hov ? C.border2 : C.border}`,
      }}
    >
      {/* Color stripe */}
      <div style={{ height: '4px', background: color, flexShrink: 0 }} />

      <div className="flex flex-col gap-3 p-4 flex-1">
        {/* Header: avatar + name */}
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-[8px] text-[18px] font-bold text-white"
            style={{ width: '44px', height: '44px', background: color }}
          >
            {getInitial(team.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold truncate" style={{ color: C.text }}>
              {team.name}
            </div>
            {team.description && (
              <div className="text-[12px] mt-0.5 truncate" style={{ color: C.text3 }}>
                {team.description}
              </div>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between text-[12px]" style={{ color: C.text3 }}>
          <div className="flex items-center gap-1.5">
            <Users size={12} />
            <span>{t.teams_members_count(team.memberCount ?? 0)}</span>
          </div>
          {team.leadName && (
            <div className="flex items-center gap-1.5 truncate max-w-[120px]">
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ width: '16px', height: '16px', background: color }}
              >
                {getInitial(team.leadName)}
              </div>
              <span className="truncate">{team.leadName}</span>
            </div>
          )}
        </div>

        {/* Updated at */}
        <div className="text-[11px]" style={{ color: C.text4 }}>
          Actualizado {timeAgo(team.updatedAt)}
        </div>
      </div>
    </div>
  );
}

// ── Create Team Modal ─────────────────────────────────────────────────────────

const COLOR_OPTIONS = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899','#06b6d4','#fb923c','#84cc16','#ef4444','#8b5cf6'];

function CreateTeamModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: { name: string; description?: string; color: string }) => Promise<void>;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), description: description.trim() || undefined, color });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear equipo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-[10px] flex flex-col"
        style={{ background: C.surface, border: `1px solid ${C.border2}`, width: '440px', maxWidth: '90vw' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span className="text-[14px] font-semibold" style={{ color: C.text }}>{t.teams_create_title}</span>
          <button
            onClick={onClose}
            className="rounded-[5px] transition-colors flex items-center justify-center"
            style={{ width: '24px', height: '24px', color: C.text3 }}
            onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text); }}
            onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text3); }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: C.text2 }}>{t.teams_create_name_label}</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.teams_create_name_placeholder}
              className="rounded-[6px] px-3 text-[13px] outline-none transition-colors"
              style={{
                background: C.bg,
                border: `1px solid ${C.border2}`,
                color: C.text,
                height: '36px',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.border2)}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: C.text2 }}>{t.teams_create_desc_label}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.teams_create_desc_placeholder}
              rows={2}
              className="rounded-[6px] px-3 py-2 text-[13px] outline-none resize-none transition-colors"
              style={{
                background: C.bg,
                border: `1px solid ${C.border2}`,
                color: C.text,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.border2)}
            />
          </div>

          {/* Color */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: C.text2 }}>{t.teams_create_color_label}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="rounded-full transition-all"
                  style={{
                    width: '22px', height: '22px', background: c,
                    outline: color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div
            className="flex items-center gap-3 rounded-[6px] p-3"
            style={{ background: C.bg, border: `1px solid ${C.border}` }}
          >
            <div
              className="flex items-center justify-center rounded-[6px] text-[14px] font-bold text-white flex-shrink-0"
              style={{ width: '36px', height: '36px', background: color }}
            >
              {getInitial(name || 'E')}
            </div>
            <div>
              <div className="text-[13px] font-medium" style={{ color: C.text }}>{name || 'Nombre del equipo'}</div>
              {description && <div className="text-[12px] mt-0.5" style={{ color: C.text3 }}>{description}</div>}
            </div>
          </div>

          {error && (
            <div className="text-[12px] px-3 py-2 rounded-[6px]" style={{ background: 'rgba(239,68,68,0.1)', color: C.red, border: `1px solid rgba(239,68,68,0.25)` }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 rounded-[6px] text-[13px] transition-colors"
              style={{ height: '34px', color: C.text2, border: `1px solid ${C.border2}`, background: 'transparent' }}
              onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text); }}
              onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text2); }}
            >
              {t.teams_create_btn_cancel}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="px-4 rounded-[6px] text-[13px] font-medium transition-colors"
              style={{
                height: '34px',
                background: !name.trim() || loading ? C.border2 : C.accent,
                color: !name.trim() || loading ? C.text4 : '#fff',
                cursor: !name.trim() || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? t.teams_create_btn_creating : t.teams_create_btn_create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const t = useT();
  const router = useRouter();
  const { teams, isLoading, fetchTeams, createTeam } = useTeamStore();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate(data: { name: string; description?: string; color: string }) {
    const team = await createTeam(data);
    router.push(`/dashboard/teams/${team.id}`);
  }

  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-8 py-5"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div>
          <h1 className="text-[20px] font-semibold" style={{ color: C.text }}>{t.teams_title}</h1>
          <p className="text-[13px] mt-0.5" style={{ color: C.text3 }}>
            {t.teams_members_count(teams.length)} · {t.teams_subtitle}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-[6px] text-[13px] font-medium transition-colors"
          style={{ height: '34px', padding: '0 14px', background: C.accent, color: '#fff' }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <Plus size={14} />
          {t.teams_btn_create}
        </button>
      </div>

      {/* Search */}
      {teams.length > 0 && (
        <div className="flex-shrink-0 px-8 py-4">
          <div
            className="flex items-center gap-2.5 rounded-[6px] px-3"
            style={{ background: C.surface, border: `1px solid ${C.border}`, height: '36px', maxWidth: '340px' }}
          >
            <Search size={13} style={{ color: C.text3, flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.teams_search_placeholder}
              className="flex-1 text-[13px] outline-none bg-transparent"
              style={{ color: C.text }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: C.border2, borderTopColor: C.accent }} />
          </div>
        ) : teams.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: '56px', height: '56px', background: C.surface, border: `1px solid ${C.border}` }}
            >
              <Users size={24} style={{ color: C.text4 }} />
            </div>
            <div className="text-center">
              <div className="text-[15px] font-medium" style={{ color: C.text }}>{t.teams_empty_title}</div>
              <div className="text-[13px] mt-1" style={{ color: C.text3 }}>
                {t.teams_empty_desc}
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-[6px] text-[13px] font-medium mt-2 transition-colors"
              style={{ height: '34px', padding: '0 16px', background: C.accent, color: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <Plus size={14} />
              {t.teams_empty_btn}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <div className="text-[14px]" style={{ color: C.text3 }}>Sin resultados para "{search}"</div>
          </div>
        ) : (
          <div className="grid gap-4 pt-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {filtered.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onClick={() => router.push(`/dashboard/teams/${team.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTeamModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
