'use client';

import type { Document } from '@aether/types';
import { useT } from '@/lib/i18n';

type ProjectMember = { memberId?: string; id: string; name: string };

type Props = {
  documents: Document[];
  members: ProjectMember[];
  color: string;
  canEdit: boolean;
  onCreate: () => void;
  onOpen: (documentId: string) => void;
};

function snippet(content: string) {
  const text = (content ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 120)}…` : text || 'Documento vacío';
}

function wordCount(content: string) {
  const count = (content ?? '').trim() ? (content.trim().match(/\S+/g)?.length ?? 0) : 0;
  return `${count.toLocaleString('es-ES')} ${count === 1 ? 'palabra' : 'palabras'}`;
}

function timeAgo(value: string, t: ReturnType<typeof useT>) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(elapsed / 3_600_000);
  const days = Math.floor(elapsed / 86_400_000);
  if (minutes < 1) return t.projects_time_ago_now;
  if (minutes < 60) return t.projects_time_ago_min(minutes);
  if (hours < 24) return t.projects_time_ago_h(hours);
  return t.projects_time_ago_d(days);
}

function memberName(members: ProjectMember[], userId: string) {
  return members.find((member) => member.memberId === userId || member.id === userId)?.name ?? 'Un miembro';
}

function memberColor(id: string) {
  const palette = ['#F2571E', '#76A878', '#4B607F', '#DB8A66', '#8C7C9E', '#C2904B'];
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return palette[hash % palette.length];
}

export function ProjectDocumentsTab({ documents, members, color, canEdit, onCreate, onOpen }: Props) {
  const t = useT();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: '0.98rem', color: '#9C9486', fontFamily: "'Manrope', system-ui, sans-serif" }}>Documentos asociados a este proyecto.</p>
        {canEdit && <CreateButton onClick={onCreate} />}
      </div>

      {documents.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '60px 0', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <span style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DocumentIcon color="#615846" size={22} />
          </span>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#9C9486', fontFamily: "'Sora', system-ui, sans-serif" }}>Aún no hay documentos</p>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#615846' }}>Crea un documento para empezar a colaborar</p>
          {canEdit && <CreateButton onClick={onCreate} />}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {documents.map((document) => {
            const author = memberName(members, document.createdBy);
            return (
              <button key={document.id} type="button" onClick={() => onOpen(document.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
                <span style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><DocumentIcon color={color} size={19} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '14.5px', fontWeight: 600, color: '#E8E1D2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{document.title}</span>
                  <span style={{ display: 'block', fontSize: '12.5px', color: '#827A6D', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{snippet(document.content)}</span>
                </span>
                <span style={{ fontSize: '12px', color: '#827A6D', flexShrink: 0 }}>Editado {timeAgo(document.updatedAt, t)}</span>
                <span style={{ fontSize: '12px', color: '#5C5447', width: '104px', textAlign: 'right', flexShrink: 0 }}>{wordCount(document.content)}</span>
                <span title={author} style={{ width: '26px', height: '26px', borderRadius: '50%', background: memberColor(document.createdBy), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#24180A', flexShrink: 0 }}>{author.trim()[0]?.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#F2571E', color: '#24180A', fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#24180A" strokeWidth="2.2" strokeLinecap="round" /></svg>Nuevo documento</button>;
}

function DocumentIcon({ color, size }: { color: string; size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M6 3h8l4 4v14H6V3Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><path d="M13 3v5h5" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}
