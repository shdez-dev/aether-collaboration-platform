// apps/web/src/app/dashboard/workspaces/[id]/boards/[boardId]/dependencies/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  MarkerType,
  Panel,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { apiService } from '@/services/apiService';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  GitBranch,
  Lock,
  CheckCircle2,
  Circle,
} from 'lucide-react';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:      '#0b0d10',
  bg2:     '#0f1117',
  surface: '#14171c',
  surface2:'#1a1d23',
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
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface GraphCard {
  id: string;
  title: string;
  completed: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  listId: string;
  listName: string;
  listPosition: number;
  blockedByPendingCount: number;
}

interface GraphEdge {
  id: string;
  blockingCardId: string;
  blockedCardId: string;
}

interface GraphData {
  cards: GraphCard[];
  edges: GraphEdge[];
}

type CardNodeData = { card: GraphCard };

// ─── Constantes de layout ─────────────────────────────────────────────────────

const NODE_W = 220;
const NODE_H = 100;
const COL_GAP = 160;
const ROW_GAP = 40;

// ─── Nodo personalizado ───────────────────────────────────────────────────────

function CardNode({ data }: NodeProps) {
  const { card } = data as CardNodeData;
  const isBlocked = card.blockedByPendingCount > 0 && !card.completed;

  // Colores de estado del nodo
  const nodeBorder = card.completed
    ? `${C.green}55`
    : isBlocked
      ? `${C.amber}55`
      : C.border2;

  const nodeBg = card.completed
    ? `${C.green}0d`
    : isBlocked
      ? `${C.amber}0d`
      : C.surface;

  const handleColor = card.completed
    ? C.green
    : isBlocked
      ? C.amber
      : C.text4;

  // Prioridad
  const priorityMap: Record<string, { color: string; bg: string; border: string; label: string }> = {
    HIGH:   { color: C.red,   bg: `${C.red}12`,   border: `${C.red}40`,   label: '▲ Alta'  },
    MEDIUM: { color: C.amber, bg: `${C.amber}12`,  border: `${C.amber}40`, label: '■ Media' },
    LOW:    { color: C.accent,bg: `${C.accent}12`, border: `${C.accent}40`,label: '▼ Baja'  },
  };
  const pri = card.priority ? priorityMap[card.priority] : null;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: handleColor,
          border: `2px solid ${C.bg}`,
          width: 9,
          height: 9,
        }}
      />

      <div style={{
        width: NODE_W,
        background: nodeBg,
        border: `1px solid ${nodeBorder}`,
        borderRadius: '10px',
        padding: '11px 13px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}>
        {/* Lista + iconos */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', gap: '6px' }}>
          <span style={{
            fontSize: '10px', color: C.text4, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {card.listName}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {isBlocked && (
              <Lock style={{ width: '11px', height: '11px', color: C.amber }} />
            )}
            {card.completed
              ? <CheckCircle2 style={{ width: '13px', height: '13px', color: C.green }} />
              : <Circle style={{ width: '13px', height: '13px', color: C.text4 }} />
            }
          </div>
        </div>

        {/* Título */}
        <p style={{
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.4,
          marginBottom: '8px',
          color: card.completed ? C.text3 : C.text,
          textDecoration: card.completed ? 'line-through' : 'none',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {card.title}
        </p>

        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          {pri && (
            <span style={{
              fontSize: '9px', fontWeight: 600,
              padding: '2px 6px', borderRadius: '4px',
              color: pri.color, background: pri.bg, border: `1px solid ${pri.border}`,
            }}>
              {pri.label}
            </span>
          )}
          {isBlocked && (
            <span style={{
              fontSize: '9px', fontWeight: 600,
              padding: '2px 6px', borderRadius: '4px',
              color: C.amber, background: `${C.amber}12`, border: `1px solid ${C.amber}40`,
            }}>
              {card.blockedByPendingCount} bloqueante{card.blockedByPendingCount !== 1 ? 's' : ''}
            </span>
          )}
          {card.completed && (
            <span style={{
              fontSize: '9px', fontWeight: 600,
              padding: '2px 6px', borderRadius: '4px',
              color: C.green, background: `${C.green}12`, border: `1px solid ${C.green}40`,
            }}>
              Completada
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: card.completed ? C.green : C.text4,
          border: `2px solid ${C.bg}`,
          width: 9,
          height: 9,
        }}
      />
    </>
  );
}

const nodeTypes = { card: CardNode };

// ─── Layout topológico ────────────────────────────────────────────────────────

function computeLayout(cards: GraphCard[], apiEdges: GraphEdge[]): Node[] {
  if (cards.length === 0) return [];

  const ids = cards.map((c) => c.id);
  const children = new Map<string, string[]>(ids.map((id) => [id, []]));
  const parents  = new Map<string, string[]>(ids.map((id) => [id, []]));

  for (const e of apiEdges) {
    children.get(e.blockingCardId)?.push(e.blockedCardId);
    parents.get(e.blockedCardId)?.push(e.blockingCardId);
  }

  const level = new Map<string, number>(ids.map((id) => [id, 0]));
  const roots = ids.filter((id) => (parents.get(id)?.length ?? 0) === 0);
  const queue = roots.length > 0 ? [...roots] : [...ids];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const currentLevel = level.get(current) ?? 0;
    for (const child of children.get(current) ?? []) {
      if ((level.get(child) ?? 0) <= currentLevel) level.set(child, currentLevel + 1);
      queue.push(child);
    }
  }

  const byLevel = new Map<number, string[]>();
  for (const [id, lv] of level.entries()) {
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(id);
  }

  const maxInLevel = Math.max(...[...byLevel.values()].map((v) => v.length));
  const totalHeight = maxInLevel * (NODE_H + ROW_GAP) - ROW_GAP;
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const nodes: Node[] = [];

  for (const [lv, lvIds] of byLevel.entries()) {
    const colHeight = lvIds.length * (NODE_H + ROW_GAP) - ROW_GAP;
    const startY = (totalHeight - colHeight) / 2;
    lvIds.forEach((id, rowIdx) => {
      const card = cardMap.get(id)!;
      nodes.push({
        id,
        type: 'card',
        position: { x: lv * (NODE_W + COL_GAP), y: startY + rowIdx * (NODE_H + ROW_GAP) },
        data: { card },
        draggable: true,
      });
    });
  }

  return nodes;
}

// ─── Edges ────────────────────────────────────────────────────────────────────

function buildEdges(apiEdges: GraphEdge[], cards: GraphCard[]): Edge[] {
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  return apiEdges.map((e) => {
    const blocking = cardMap.get(e.blockingCardId);
    const isActive = blocking && !blocking.completed;
    const color = isActive ? C.amber : C.green;

    return {
      id: e.id,
      source: e.blockingCardId,
      target: e.blockedCardId,
      type: 'smoothstep',
      animated: !!isActive,
      style: {
        stroke: color,
        strokeWidth: isActive ? 2 : 1.5,
        strokeDasharray: isActive ? undefined : '6 3',
        opacity: 0.85,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
        width: 18,
        height: 18,
      },
      label: isActive ? '' : '✓',
      labelStyle: { fill: color, fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: C.surface, fillOpacity: 0.92 },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 3,
    };
  });
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DependencyMapPage() {
  const params = useParams();
  const router = useRouter();

  const workspaceId = params.id as string;
  const boardId     = params.boardId as string;

  const [graph,     setGraph]     = useState<GraphData | null>(null);
  const [boardName, setBoardName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const fetchGraph = useCallback(async () => {
    if (!boardId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [graphRes, boardRes] = await Promise.all([
        apiService.get<{ graph: any }>(`/api/boards/${boardId}/dependency-graph`, true),
        apiService.get<{ board: any }>(`/api/boards/${boardId}`, true),
      ]);
      if (!graphRes.success) throw new Error('Error al cargar el grafo');
      setGraph(graphRes.data!.graph);
      if (boardRes.success && boardRes.data) setBoardName(boardRes.data.board?.name ?? '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [boardId]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  useEffect(() => {
    if (!graph) return;
    setNodes(computeLayout(graph.cards, graph.edges));
    setEdges(buildEdges(graph.edges, graph.cards));
  }, [graph, setNodes, setEdges]);

  const stats = useMemo(() => {
    if (!graph) return null;
    const blocked   = graph.cards.filter((c) => c.blockedByPendingCount > 0 && !c.completed).length;
    const completed = graph.cards.filter((c) => c.completed).length;
    return { total: graph.cards.length, blocked, completed, deps: graph.edges.length };
  }, [graph]);

  const handleBack = () => router.push(`/dashboard/workspaces/${workspaceId}/boards/${boardId}`);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: C.bg,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            border: `2px solid ${C.accent}`, borderTopColor: 'transparent',
            margin: '0 auto 16px',
            animation: 'spin 0.7s linear infinite',
          }} />
          <p style={{ fontSize: '13px', color: C.text3 }}>Cargando mapa de dependencias…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: C.bg,
      }}>
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `${C.red}15`, border: `1px solid ${C.red}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <AlertTriangle style={{ width: '18px', height: '18px', color: C.red }} />
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>
            Error al cargar el grafo
          </p>
          <p style={{ fontSize: '12.5px', color: C.text3, marginBottom: '20px' }}>{error}</p>
          <button
            onClick={fetchGraph}
            style={{
              padding: '8px 20px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
              background: C.accent, color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ── Sin dependencias ───────────────────────────────────────────────────────
  if (!graph || graph.cards.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg }}>
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '0 20px', height: '52px', flexShrink: 0,
          background: C.surface, borderBottom: `1px solid ${C.border}`,
        }}>
          <BackButton onClick={handleBack} />
          <div style={{ width: '1px', height: '18px', background: C.border2 }} />
          <GitBranch style={{ width: '14px', height: '14px', color: C.accent }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>
            {boardName ? `${boardName} — ` : ''}Mapa de Dependencias
          </span>
        </header>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '340px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: `${C.accent}12`, border: `1px solid ${C.accent}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <GitBranch style={{ width: '20px', height: '20px', color: C.accent }} />
            </div>
            <p style={{ fontSize: '15px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>
              Sin dependencias
            </p>
            <p style={{ fontSize: '13px', color: C.text3, lineHeight: 1.6, marginBottom: '24px' }}>
              Este tablero no tiene dependencias entre cards. Abre una card y añade una dependencia para verla aquí.
            </p>
            <button
              onClick={handleBack}
              style={{
                padding: '8px 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
                background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer',
              }}
            >
              Volver al tablero
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Mapa ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: '52px', flexShrink: 0,
        background: C.surface, borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BackButton onClick={handleBack} />
          <div style={{ width: '1px', height: '18px', background: C.border2 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <GitBranch style={{ width: '14px', height: '14px', color: C.accent }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>
              {boardName ? `${boardName} — ` : ''}Mapa de Dependencias
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Stats */}
          {stats && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <StatChip label={`${stats.total} cards`} color={C.text3} />
              {stats.blocked > 0 && (
                <StatChip
                  icon={<Lock style={{ width: '11px', height: '11px' }} />}
                  label={`${stats.blocked} bloqueada${stats.blocked !== 1 ? 's' : ''}`}
                  color={C.amber}
                />
              )}
              <StatChip
                icon={<CheckCircle2 style={{ width: '11px', height: '11px' }} />}
                label={`${stats.completed} completada${stats.completed !== 1 ? 's' : ''}`}
                color={C.green}
              />
              <StatChip
                label={`${stats.deps} dependencia${stats.deps !== 1 ? 's' : ''}`}
                color={C.text4}
              />
            </div>
          )}

          {/* Refresh */}
          <RefreshButton onClick={fetchGraph} />
        </div>
      </header>

      {/* ── Leyenda ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '20px',
        padding: '0 20px', height: '36px', flexShrink: 0,
        background: C.bg2, borderBottom: `1px solid ${C.border}`,
        fontSize: '11px', color: C.text4, overflowX: 'auto',
      }}>
        <span style={{ fontWeight: 600, color: C.text3, flexShrink: 0 }}>Leyenda:</span>

        {/* Activa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <svg width="26" height="8" viewBox="0 0 26 8">
            <line x1="0" y1="4" x2="26" y2="4" stroke={C.amber} strokeWidth="2" />
            <polygon points="20,0 26,4 20,8" fill={C.amber} />
          </svg>
          <span>Dependencia activa</span>
        </div>

        {/* Resuelta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <svg width="26" height="8" viewBox="0 0 26 8">
            <line x1="0" y1="4" x2="26" y2="4" stroke={C.green} strokeWidth="1.5" strokeDasharray="5 3" />
            <polygon points="20,0 26,4 20,8" fill={C.green} />
          </svg>
          <span>Dependencia resuelta</span>
        </div>

        {/* Indicadores de estado */}
        <LegendDot color={C.amber} bg={`${C.amber}15`} border={`${C.amber}50`} label="Bloqueada" />
        <LegendDot color={C.green} bg={`${C.green}15`} border={`${C.green}50`} label="Completada" />
        <LegendDot color={C.text4} bg={C.surface} border={C.border2} label="Pendiente" />

        <span style={{ color: C.border2, flexShrink: 0 }}>·</span>
        <span style={{ flexShrink: 0 }}>Flujo: izquierda → derecha</span>
      </div>

      {/* ── Canvas ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
          minZoom={0.15}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          colorMode="dark"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1}
            color={C.border2}
          />
          <Controls style={{
            background: C.surface,
            border: `1px solid ${C.border2}`,
            borderRadius: '8px',
            overflow: 'hidden',
          }} />
          <MiniMap
            nodeColor={(node) => {
              const card = (node.data as CardNodeData).card;
              if (card.completed) return C.green;
              if (card.blockedByPendingCount > 0) return C.amber;
              return C.border2;
            }}
            style={{
              background: C.surface,
              border: `1px solid ${C.border2}`,
              borderRadius: '8px',
            }}
            maskColor="rgba(0,0,0,0.45)"
          />
          <Panel position="bottom-center">
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '7px 16px', borderRadius: '8px', marginBottom: '12px',
              background: `${C.surface}ee`, border: `1px solid ${C.border2}`,
              backdropFilter: 'blur(8px)',
              fontSize: '11.5px', color: C.text4,
            }}>
              <span>Arrastra nodos para reorganizar</span>
              <span style={{ color: C.border2 }}>·</span>
              <span>Rueda del ratón para zoom</span>
              <span style={{ color: C.border2 }}>·</span>
              <span>Clic y arrastra el fondo para navegar</span>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '5px 10px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500,
        background: hovered ? C.hover : 'transparent',
        border: `1px solid ${hovered ? C.border2 : 'transparent'}`,
        color: hovered ? C.text : C.text3,
        cursor: 'pointer', transition: 'all 0.12s ease',
      }}
    >
      <ArrowLeft style={{ width: '13px', height: '13px' }} />
      Volver al tablero
    </button>
  );
}

function RefreshButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '5px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
        background: hovered ? C.hover : 'transparent',
        border: `1px solid ${hovered ? C.border2 : C.border}`,
        color: hovered ? C.text2 : C.text3,
        cursor: 'pointer', transition: 'all 0.12s ease',
      }}
    >
      <RefreshCw style={{ width: '12px', height: '12px' }} />
      Actualizar
    </button>
  );
}

function StatChip({ icon, label, color }: { icon?: React.ReactNode; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color, fontSize: '12px' }}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function LegendDot({ color, bg, border, label }: { color: string; bg: string; border: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
      <div style={{
        width: '11px', height: '11px', borderRadius: '3px',
        background: bg, border: `1px solid ${border}`,
      }} />
      <span>{label}</span>
    </div>
  );
}
