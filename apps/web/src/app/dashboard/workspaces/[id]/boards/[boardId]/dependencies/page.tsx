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
import { useAuthStore } from '@/stores/authStore';
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

type CardNodeData = { card: GraphCard };

// ─── Constantes de layout ─────────────────────────────────────────────────────

const NODE_W = 220;
const NODE_H = 100;
const COL_GAP = 160; // espacio horizontal entre niveles
const ROW_GAP = 40; // espacio vertical entre nodos del mismo nivel

// ─── Nodo personalizado con Handles ──────────────────────────────────────────

function CardNode({ data }: NodeProps) {
  const { card } = data as CardNodeData;

  const priorityStyle: Record<string, string> = {
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

  return (
    <>
      {/* Handle izquierdo: donde llegan las flechas (target) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: isBlocked ? '#f59e0b' : card.completed ? '#22c55e' : '#71717a',
          border: '2px solid #18181b',
          width: 10,
          height: 10,
        }}
      />

      <div
        style={{ width: NODE_W }}
        className={`
          rounded-lg border-2 p-3 shadow-xl font-mono text-sm
          ${
            card.completed
              ? 'bg-emerald-950/80 border-emerald-500/50'
              : isBlocked
                ? 'bg-amber-950/80 border-amber-500/60'
                : 'bg-zinc-900 border-zinc-600 hover:border-zinc-400'
          }
        `}
      >
        {/* Lista de origen */}
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span className="text-[10px] text-zinc-500 truncate" title={card.listName}>
            {card.listName}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isBlocked && (
              <span title={`Bloqueada por ${card.blockedByPendingCount} dependencia(s)`}>
                <Lock className="w-3 h-3 text-amber-400" />
              </span>
            )}
            {card.completed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-zinc-600" />
            )}
          </div>
        </div>

        {/* Título */}
        <p
          className={`text-[13px] leading-snug mb-2 font-medium ${
            card.completed ? 'line-through text-zinc-500' : 'text-zinc-100'
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
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300">
              {card.blockedByPendingCount} bloqueante{card.blockedByPendingCount !== 1 ? 's' : ''}
            </span>
          )}
          {card.completed && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
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
          background: card.completed ? '#22c55e' : '#71717a',
          border: '2px solid #18181b',
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

function computeLayout(cards: GraphCard[], apiEdges: GraphEdge[]): Node[] {
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

    return {
      id: e.id,
      source: e.blockingCardId,
      target: e.blockedCardId,
      type: 'smoothstep',
      animated: !!isActive,
      style: {
        stroke: isActive ? '#f59e0b' : '#22c55e',
        strokeWidth: isActive ? 2.5 : 1.5,
        strokeDasharray: isActive ? undefined : '6 3',
        opacity: 0.9,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isActive ? '#f59e0b' : '#22c55e',
        width: 20,
        height: 20,
      },
      label: isActive ? 'bloquea' : '✓',
      labelStyle: {
        fill: isActive ? '#f59e0b' : '#22c55e',
        fontSize: 10,
        fontFamily: 'monospace',
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: '#18181b',
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
  const { accessToken } = useAuthStore();

  const workspaceId = params.id as string;
  const boardId = params.boardId as string;

  const [graph, setGraph] = useState<GraphData | null>(null);
  const [boardName, setBoardName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const fetchGraph = useCallback(async () => {
    if (!accessToken || !boardId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [graphRes, boardRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/boards/${boardId}/dependency-graph`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/boards/${boardId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      if (!graphRes.ok) throw new Error('Error al cargar el grafo');
      const { data } = await graphRes.json();
      setGraph(data.graph);

      if (boardRes.ok) {
        const boardData = await boardRes.json();
        setBoardName(boardData.data?.board?.name ?? '');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, boardId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Recalcular layout cuando llegan datos
  useEffect(() => {
    if (!graph) return;
    const computedNodes = computeLayout(graph.cards, graph.edges);
    const computedEdges = buildEdges(graph.edges, graph.cards);
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [graph, setNodes, setEdges]);

  // Stats
  const stats = useMemo(() => {
    if (!graph) return null;
    const blocked = graph.cards.filter((c) => c.blockedByPendingCount > 0 && !c.completed).length;
    const completed = graph.cards.filter((c) => c.completed).length;
    return { total: graph.cards.length, blocked, completed, deps: graph.edges.length };
  }, [graph]);

  const handleBack = () => router.push(`/dashboard/workspaces/${workspaceId}/boards/${boardId}`);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-zinc-400 font-mono text-sm">Cargando mapa de dependencias…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-zinc-200 font-mono mb-2">Error al cargar el grafo</p>
          <p className="text-zinc-400 text-sm font-mono mb-4">{error}</p>
          <button
            onClick={fetchGraph}
            className="px-4 py-2 bg-amber-500 text-black font-mono text-sm hover:bg-amber-400 transition-colors"
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
      <div className="flex flex-col h-screen bg-zinc-950">
        <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4 bg-zinc-900">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all font-mono"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al tablero
          </button>
          <div className="w-px h-6 bg-zinc-700" />
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-amber-400" />
            <span className="text-zinc-200 font-mono font-medium">
              {boardName ? `${boardName} — ` : ''}Mapa de Dependencias
            </span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <GitBranch className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-300 font-mono text-base mb-2">Sin dependencias</p>
            <p className="text-zinc-500 font-mono text-sm">
              Este tablero no tiene dependencias entre cards todavía. Abre una card y agrega una
              dependencia para verla aquí.
            </p>
            <button
              onClick={handleBack}
              className="mt-6 px-4 py-2 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors font-mono text-sm"
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
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between bg-zinc-900 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all font-mono"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al tablero
          </button>
          <div className="w-px h-6 bg-zinc-700" />
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-amber-400" />
            <span className="text-zinc-200 font-mono font-medium">
              {boardName ? `${boardName} — ` : ''}Mapa de Dependencias
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {stats && (
            <div className="flex items-center gap-5 font-mono text-xs">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                <span>{stats.total} cards</span>
              </div>
              {stats.blocked > 0 && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Lock className="w-3 h-3" />
                  <span>
                    {stats.blocked} bloqueada{stats.blocked !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>
                  {stats.completed} completada{stats.completed !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-500">
                <span>
                  {stats.deps} dependencia{stats.deps !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={fetchGraph}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-500 transition-all font-mono"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
        </div>
      </header>

      {/* Leyenda */}
      <div className="px-6 py-2 flex items-center gap-5 border-b border-zinc-800 bg-zinc-900/60 font-mono text-xs text-zinc-400 flex-shrink-0 overflow-x-auto">
        <span className="font-medium text-zinc-300 flex-shrink-0">Leyenda:</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <svg width="28" height="10" viewBox="0 0 28 10">
            <line x1="0" y1="5" x2="28" y2="5" stroke="#f59e0b" strokeWidth="2.5" />
            <polygon points="22,1 28,5 22,9" fill="#f59e0b" />
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
              stroke="#22c55e"
              strokeWidth="1.5"
              strokeDasharray="5 3"
            />
            <polygon points="22,1 28,5 22,9" fill="#22c55e" />
          </svg>
          <span>Dependencia resuelta</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-3 h-3 rounded border-2 border-amber-500/60 bg-amber-950/80" />
          <span>Bloqueada</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-3 h-3 rounded border-2 border-emerald-500/50 bg-emerald-950/80" />
          <span>Completada</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-3 h-3 rounded border-2 border-zinc-600 bg-zinc-900" />
          <span>Pendiente</span>
        </div>
        <span className="text-zinc-600 flex-shrink-0">·</span>
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
          colorMode="dark"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#3f3f46" />
          <Controls
            style={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: 4 }}
          />
          <MiniMap
            nodeColor={(node) => {
              const card = (node.data as CardNodeData).card;
              if (card.completed) return '#22c55e';
              if (card.blockedByPendingCount > 0) return '#f59e0b';
              return '#52525b';
            }}
            style={{ background: '#18181b', border: '1px solid #3f3f46' }}
            maskColor="rgba(0,0,0,0.45)"
          />
          <Panel position="bottom-center">
            <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/90 border border-zinc-700 text-xs text-zinc-400 font-mono backdrop-blur rounded-md mb-2">
              <span>Arrastra nodos para reorganizar</span>
              <span className="text-zinc-600">·</span>
              <span>Rueda del ratón para zoom</span>
              <span className="text-zinc-600">·</span>
              <span>Clic y arrastra el fondo para navegar</span>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
