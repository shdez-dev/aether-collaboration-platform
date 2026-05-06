// apps/web/src/components/realtime/RemoteCursors.tsx
'use client';

import { RemoteCursor } from '@/hooks/useBoardCursors';

interface RemoteCursorsProps {
  cursors: RemoteCursor[];
}

/**
 * Renderiza los cursores de otros usuarios sobre el board.
 * Se posiciona absolute dentro de un contenedor con position:relative.
 * Las coordenadas son porcentaje del contenedor (0–100).
 */
export function RemoteCursors({ cursors }: RemoteCursorsProps) {
  if (cursors.length === 0) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      {cursors.map((cursor) => (
        <div
          key={cursor.userId}
          style={{
            position: 'absolute',
            left: `${cursor.x}%`,
            top: `${cursor.y}%`,
            transition: 'left 80ms linear, top 80ms linear',
            pointerEvents: 'none',
            willChange: 'left, top',
          }}
        >
          {/* Puntero SVG */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 18 18"
            fill="none"
            style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.35))' }}
          >
            <path
              d="M2 2L16 8L8 10L6 16L2 2Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>

          {/* Etiqueta con nombre */}
          <span
            style={{
              position: 'absolute',
              top: '15px',
              left: '11px',
              fontSize: '11px',
              fontWeight: 600,
              lineHeight: 1,
              padding: '3px 7px',
              borderRadius: '4px',
              background: cursor.color,
              color: 'white',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono, monospace)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              userSelect: 'none',
            }}
          >
            {cursor.name.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>
  );
}
