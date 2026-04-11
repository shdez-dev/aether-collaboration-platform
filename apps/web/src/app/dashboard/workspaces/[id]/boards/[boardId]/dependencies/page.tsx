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
import { useTheme } from '@/providers/ThemeProvider';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  GitBranch,
  Lock,
  CheckCircle2,
  Circle,
} from 'lucide-react';

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

type CardNodeData = { card: GraphCard; isLight: boolean };

// ─── Constantes de layout ─────────────────────────────────────────────────────

const NODE_W = 220;
const NODE_H = 100;
const COL_GAP = 160; // espacio horizontal entre niveles
const ROW_GAP = 40; // espacio vertical entre nodos del mismo nivel

// ─── Nodo personalizado con Handles ──────────────────────────────────────────

function CardNode({ data }: NodeProps) {
  const { card, isLight } = data as CardNodeData;

  const priorityStyle: Record<string, string> = isLight
    ? {
        HIGH: 'text-red-600 border-red-300 bg-red-50',
        MEDIUM: 'text-amber-600 border-amber-300 bg-amber-50',
        LOW: 'text-blue-600 border-blue-300 bg-blue-50',
      }
    : {
        HIGH: 'text-red-400 border-red-400/40 bg-red-400/10',
        MEDIUM: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10',
        LOW: 'text-blue-400 border-blue-400/40 bg-blue-400/10',
      };

  const priorityLabel: Record<string, string> = {
    HIGH: '▲ Alta',
    MEDIUM: '■ Media',
    LOW: '▼ Baja',
  };

  const isBlocked = card.blockedByPendingCount > 0 && !card.completed;

  const handleBorderColor = isLight ? '#c8d4e8' : '#18181b';

  const cardClass = isLight
    ? card.completed
      ? 'bg-emerald-50 border-emerald-400'
      : isBlocked
        ? 'bg-amber-50 border-amber-400'
        : 'bg-white border-slate-300 hover:border-slate-400'
    : card.completed
      ? 'bg-emerald-950/80 border-emerald-500/50'
      : isBlocked
        ? 'bg-amber-950/80 border-amber-500/60'
        : 'bg-zinc-900 border-zinc-600 hover:border-zinc-400';

  return (
    <>
      {/* Handle izquierdo: donde llegan las flechas (target) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: isBlocked
            ? '#f59e0b'
            : card.completed
              ? '#22c55e'
              : isLight
                ? '#94a3b8'
                : '#71717a',
          border: `2px solid ${handleBorderColor}`,
          width: 10,
          height: 10,
        }}
      />

      <div
        style={{ width: NODE_W }}
        className={`rounded-lg border-2 p-3 shadow-md font-mono text-sm ${cardClass}`}
      >
        {/* Lista de origen */}
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span
            className={`text-[10px] truncate ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}
            title={card.listName}
          >
            {card.listName}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isBlocked && (
              <span title={`Bloqueada por ${card.blockedByPendingCount} dependencia(s)`}>
                <Lock className="w-3 h-3 text-amber-500" />
              </span>
            )}
            {card.completed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Circle className={`w-3.5 h-3.5 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`} />
            )}
          </div>
        </div>

        {/* Título */}
        <p
          className={`text-[13px] leading-snug mb-2 font-medium ${
            card.completed
              ? `line-through ${isLight ? 'text-slate-400' : 'text-zinc-500'}`
              : isLight
                ? 'text-slate-800'
                : 'text-zinc-100'
          }`}
        >
          {card.title}
        </p>

        {/* Badges de prioridad / estado */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {card.priority && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border ${priorityStyle[card.priority]}`}
            >
              {priorityLabel[card.priority]}
            </span>
          )}
          {isBlocked && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border ${
                isLight
                  ? 'border-amber-300 bg-amber-50 text-amber-600'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              }`}
            >
              {card.blockedByPendingCount} bloqueante{card.blockedByPendingCount !== 1 ? 's' : ''}
            </span>
          )}
          {card.completed && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border ${
                isLight
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              Completada
            </span>
          )}
        </div>
      </div>

      {/* Handle derecho: de donde salen las flechas (source) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: card.completed ? '#22c55e' : isLight ? '#94a3b8' : '#71717a',
          border: `2px solid ${handleBorderColor}`,
          width: 10,
          height: 10,
        }}
      />
    </>
  );
}

const nodeTypes = { card: CardNode };

// ─── Layout topológico (por niveles) ─────────────────────────────────────────
//
// Asigna un "nivel" a cada nodo basándose en la profundidad máxima desde
// los nodos raíz (los que no tienen bloqueantes). Los nodos del mismo nivel
// se distribuyen verticalmente de forma centrada.

function computeLayout(cards: GraphCard[], apiEdges: GraphEdge[], isLight = false): Node[] {
  if (cards.length === 0) return [];

  const ids = cards.map((c) => c.id);

  // Construir mapa de adyacencia: blocking → [blocked]
  const children = new Map<string, string[]>(ids.map((id) => [id, []]));
  const parents = new Map<string, string[]>(ids.map((id) => [id, []]));

  for (const e of apiEdges) {
    children.get(e.blockingCardId)?.push(e.blockedCardId);
    parents.get(e.blockedCardId)?.push(e.blockingCardId);
  }

  // BFS desde las raíces para asignar nivel (longest path)
  const level = new Map<string, number>(ids.map((id) => [id, 0]));

  // Raíces: nodos sin padres
  const roots = ids.filter((id) => (parents.get(id)?.length ?? 0) === 0);

  // Si no hay raíces (ciclo roto), todos al nivel 0
  const queue = roots.length > 0 ? [...roots] : [...ids];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const currentLevel = level.get(current) ?? 0;
    for (const child of children.get(current) ?? []) {
      const childLevel = level.get(child) ?? 0;
      // Forzar que el hijo esté al menos un nivel más a la derecha
      if (childLevel <= currentLevel) {
        level.set(child, currentLevel + 1);
      }
      queue.push(child);
    }
  }

  // Agrupar nodos por nivel
  const byLevel = new Map<number, string[]>();
  for (const [id, lv] of level.entries()) {
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(id);
  }

  // Máximo de nodos en cualquier nivel (para centrar verticalmente)
  const maxInLevel = Math.max(...[...byLevel.values()].map((v) => v.length));
  const totalHeight = maxInLevel * (NODE_H + ROW_GAP) - ROW_GAP;

  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const nodes: Node[] = [];

  for (const [lv, lvIds] of byLevel.entries()) {
    const colHeight = lvIds.length * (NODE_H + ROW_GAP) - ROW_GAP;
    const startY = (totalHeight - colHeight) / 2; // centrar verticalmente

    lvIds.forEach((id, rowIdx) => {
      const card = cardMap.get(id)!;
      nodes.push({
        id,
        type: 'card',
        position: {
          x: lv * (NODE_W + COL_GAP),
          y: startY + rowIdx * (NODE_H + ROW_GAP),
        },
        data: { card, isLight },
        draggable: true,
      });
    });
  }

  return nodes;
}

// ─── Edges ────────────────────────────────────────────────────────────────────

function buildEdges(apiEdges: GraphEdge[], cards: GraphCard[], isLight = false): Edge[] {
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  // Colores de aristas según tema
  const activeColor = isLight ? '#d97706' : '#f59e0b'; // amber más suave en claro
  const resolvedColor = isLight ? '#16a34a' : '#22c55e'; // verde más suave en claro
  const labelBgFill = isLight ? '#f8fafc' : '#18181b';

  return apiEdges.map((e) => {
    const blocking = cardMap.get(e.blockingCardId);
    const isActive = blocking && !blocking.completed;

    return {
      id: e.id,
      source: e.blockingCardId,
      target: e.blockedCardId,
      type: 'smoothstep',
      animated: !!isActive,
      style: {
        stroke: isActive ? activeColor : resolvedColor,
        strokeWidth: isActive ? 2.5 : 1.5,
        strokeDasharray: isActive ? undefined : '6 3',
        opacity: isLight ? 0.85 : 0.9,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isActive ? activeColor : resolvedColor,
        width: 20,
        height: 20,
      },
      label: isActive ? '' : '✓',
      labelStyle: {
        fill: isActive ? activeColor : resolvedColor,
        fontSize: 10,
        fontFamily: 'monospace',
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: labelBgFill,
        fillOpacity: 0.9,
      },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 3,
    };
  });
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DependencyMapPage() {
  const params = useParams();
  const router = useRouter();
  const { actualTheme } = useTheme();
  const isLight = actualTheme === 'light';

  const workspaceId = params.id as string;
  const boardId = params.boardId as string;

  const [graph, setGraph] = useState<GraphData | null>(null);
  const [boardName, setBoardName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      if (boardRes.success && boardRes.data) {
        setBoardName(boardRes.data.board?.name ?? '');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Recalcular layout cuando llegan datos o cambia el tema
  useEffect(() => {
    if (!graph) return;
    const computedNodes = computeLayout(graph.cards, graph.edges, isLight);
    const computedEdges = buildEdges(graph.edges, graph.cards, isLight);
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [graph, isLight, setNodes, setEdges]);

  // Stats
  const stats = useMemo(() => {
    if (!graph) return null;
    const blocked = graph.cards.filter((c) => c.blockedByPendingCount > 0 && !c.completed).length;
    const completed = graph.cards.filter((c) => c.completed).length;
    return { total: graph.cards.length, blocked, completed, deps: graph.edges.length };
  }, [graph]);

  const handleBack = () => router.push(`/dashboard/workspaces/${workspaceId}/boards/${boardId}`);

  // Clases reutilizables según tema
  const bg = isLight ? 'bg-slate-100' : 'bg-zinc-950';
  const headerBg = isLight ? 'bg-white' : 'bg-zinc-900';
  const headerBdr = isLight ? 'border-slate-200' : 'border-zinc-800';
  const btnBase = isLight
    ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-transparent hover:border-slate-300'
    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border-transparent hover:border-zinc-700';
  const divider = isLight ? 'bg-slate-200' : 'bg-zinc-700';
  const titleText = isLight ? 'text-slate-700' : 'text-zinc-200';
  const mutedText = isLight ? 'text-slate-400' : 'text-zinc-400';
  const dimText = isLight ? 'text-slate-300' : 'text-zinc-500';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-screen ${bg}`}>
        <div className="text-center">
          <div
            className={`inline-block w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4`}
          />
          <p className={`${mutedText} font-mono text-sm`}>Cargando mapa de dependencias…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-screen ${bg}`}>
        <div className="text-center max-w-sm">
          <AlertTriangle
            className={`w-10 h-10 mx-auto mb-4 ${isLight ? 'text-red-500' : 'text-red-400'}`}
          />
          <p className={`${titleText} font-mono mb-2`}>Error al cargar el grafo</p>
          <p className={`${mutedText} text-sm font-mono mb-4`}>{error}</p>
          <button
            onClick={fetchGraph}
            className={`px-4 py-2 font-mono text-sm transition-colors ${
              isLight
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-amber-500 text-black hover:bg-amber-400'
            }`}
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
      <div className={`flex flex-col h-screen ${bg}`}>
        <header className={`border-b ${headerBdr} px-6 py-4 flex items-center gap-4 ${headerBg}`}>
          <button
            onClick={handleBack}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm border transition-all font-mono ${btnBase}`}
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al tablero
          </button>
          <div className={`w-px h-6 ${divider}`} />
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-amber-500" />
            <span className={`${titleText} font-mono font-medium`}>
              {boardName ? `${boardName} — ` : ''}Mapa de Dependencias
            </span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <GitBranch
              className={`w-12 h-12 mx-auto mb-4 ${isLight ? 'text-slate-300' : 'text-zinc-600'}`}
            />
            <p className={`${titleText} font-mono text-base mb-2`}>Sin dependencias</p>
            <p className={`${mutedText} font-mono text-sm`}>
              Este tablero no tiene dependencias entre cards todavía. Abre una card y agrega una
              dependencia para verla aquí.
            </p>
            <button
              onClick={handleBack}
              className={`mt-6 px-4 py-2 border transition-colors font-mono text-sm ${
                isLight
                  ? 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              Volver al tablero
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Colores del canvas según tema
  const activeEdgeColor = isLight ? '#d97706' : '#f59e0b';
  const resolvedEdgeColor = isLight ? '#16a34a' : '#22c55e';
  const bgDotColor = isLight ? '#cbd5e1' : '#3f3f46';
  const controlsBg = isLight ? '#ffffff' : '#27272a';
  const controlsBdr = isLight ? '#e2e8f0' : '#3f3f46';
  const minimapBg = isLight ? '#f1f5f9' : '#18181b';
  const minimapBdr = isLight ? '#e2e8f0' : '#3f3f46';
  const minimapMask = isLight ? 'rgba(241,245,249,0.6)' : 'rgba(0,0,0,0.45)';
  const legendBg = isLight ? 'bg-white/80' : 'bg-zinc-900/60';
  const legendBdr = isLight ? 'border-slate-200' : 'border-zinc-800';
  const legendText = isLight ? 'text-slate-500' : 'text-zinc-400';
  const legendTitle = isLight ? 'text-slate-600' : 'text-zinc-300';
  const panelBg = isLight
    ? 'bg-white/90 border-slate-200 text-slate-500'
    : 'bg-zinc-900/90 border-zinc-700 text-zinc-400';
  const panelDot = isLight ? 'text-slate-300' : 'text-zinc-600';

  // ── Mapa ───────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col h-screen ${bg}`}>
      {/* Header */}
      <header
        className={`border-b ${headerBdr} px-6 py-4 flex items-center justify-between ${headerBg} flex-shrink-0`}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm border transition-all font-mono ${btnBase}`}
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al tablero
          </button>
          <div className={`w-px h-6 ${divider}`} />
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-amber-500" />
            <span className={`${titleText} font-mono font-medium`}>
              {boardName ? `${boardName} — ` : ''}Mapa de Dependencias
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {stats && (
            <div className="flex items-center gap-5 font-mono text-xs">
              <div className={`flex items-center gap-1.5 ${mutedText}`}>
                <span
                  className={`w-2 h-2 rounded-full ${isLight ? 'bg-slate-400' : 'bg-zinc-500'}`}
                />
                <span>{stats.total} cards</span>
              </div>
              {stats.blocked > 0 && (
                <div
                  className={`flex items-center gap-1.5 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}
                >
                  <Lock className="w-3 h-3" />
                  <span>
                    {stats.blocked} bloqueada{stats.blocked !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              <div
                className={`flex items-center gap-1.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>
                  {stats.completed} completada{stats.completed !== 1 ? 's' : ''}
                </span>
              </div>
              <div className={`flex items-center gap-1.5 ${dimText}`}>
                <span>
                  {stats.deps} dependencia{stats.deps !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={fetchGraph}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-all font-mono ${
              isLight
                ? 'text-slate-500 hover:text-slate-800 border-slate-300 hover:border-slate-400'
                : 'text-zinc-400 hover:text-zinc-100 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
        </div>
      </header>

      {/* Leyenda */}
      <div
        className={`px-6 py-2 flex items-center gap-5 border-b ${legendBdr} ${legendBg} font-mono text-xs ${legendText} flex-shrink-0 overflow-x-auto`}
      >
        <span className={`font-medium ${legendTitle} flex-shrink-0`}>Leyenda:</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <svg width="28" height="10" viewBox="0 0 28 10">
            <line x1="0" y1="5" x2="28" y2="5" stroke={activeEdgeColor} strokeWidth="2.5" />
            <polygon points="22,1 28,5 22,9" fill={activeEdgeColor} />
          </svg>
          <span>Dependencia activa</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <svg width="28" height="10" viewBox="0 0 28 10">
            <line
              x1="0"
              y1="5"
              x2="28"
              y2="5"
              stroke={resolvedEdgeColor}
              strokeWidth="1.5"
              strokeDasharray="5 3"
            />
            <polygon points="22,1 28,5 22,9" fill={resolvedEdgeColor} />
          </svg>
          <span>Dependencia resuelta</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div
            className={`w-3 h-3 rounded border-2 ${isLight ? 'border-amber-400 bg-amber-50' : 'border-amber-500/60 bg-amber-950/80'}`}
          />
          <span>Bloqueada</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div
            className={`w-3 h-3 rounded border-2 ${isLight ? 'border-emerald-400 bg-emerald-50' : 'border-emerald-500/50 bg-emerald-950/80'}`}
          />
          <span>Completada</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div
            className={`w-3 h-3 rounded border-2 ${isLight ? 'border-slate-300 bg-white' : 'border-zinc-600 bg-zinc-900'}`}
          />
          <span>Pendiente</span>
        </div>
        <span className={`${isLight ? 'text-slate-300' : 'text-zinc-600'} flex-shrink-0`}>·</span>
        <span className="flex-shrink-0">Flujo: izquierda → derecha</span>
      </div>

      {/* Canvas */}
      <div className="flex-1">
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
          colorMode={isLight ? 'light' : 'dark'}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={bgDotColor} />
          <Controls
            style={{ background: controlsBg, border: `1px solid ${controlsBdr}`, borderRadius: 4 }}
          />
          <MiniMap
            nodeColor={(node) => {
              const card = (node.data as CardNodeData).card;
              if (card.completed) return isLight ? '#16a34a' : '#22c55e';
              if (card.blockedByPendingCount > 0) return isLight ? '#d97706' : '#f59e0b';
              return isLight ? '#94a3b8' : '#52525b';
            }}
            style={{ background: minimapBg, border: `1px solid ${minimapBdr}` }}
            maskColor={minimapMask}
          />
          <Panel position="bottom-center">
            <div
              className={`flex items-center gap-3 px-4 py-2 border text-xs font-mono backdrop-blur rounded-md mb-2 ${panelBg}`}
            >
              <span>Arrastra nodos para reorganizar</span>
              <span className={panelDot}>·</span>
              <span>Rueda del ratón para zoom</span>
              <span className={panelDot}>·</span>
              <span>Clic y arrastra el fondo para navegar</span>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
