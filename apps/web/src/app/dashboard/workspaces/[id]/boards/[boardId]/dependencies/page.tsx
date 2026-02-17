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

// ─── Tipos del grafo ──────────────────────────────────────────────────────────

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

// ─── Constantes de layout ─────────────────────────────────────────────────────

const NODE_WIDTH = 240;
const NODE_HEIGHT = 90;
const COL_GAP = 120; // espacio horizontal entre columnas
const ROW_GAP = 28; // espacio vertical entre nodos dentro de una columna

// ─── Nodo personalizado ───────────────────────────────────────────────────────

type CardNodeData = {
  card: GraphCard;
};

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
    <div
      className={`
        w-[240px] rounded-lg border-2 p-3 shadow-lg font-mono text-sm transition-all
        ${
          card.completed
            ? 'bg-emerald-950/60 border-emerald-500/50'
            : isBlocked
              ? 'bg-amber-950/60 border-amber-500/60'
              : 'bg-zinc-900 border-zinc-600 hover:border-zinc-400'
        }
      `}
    >
      {/* Header: estado + lista */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-[10px] text-zinc-400 truncate max-w-[140px]" title={card.listName}>
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
            <Circle className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </div>
      </div>

      {/* Título */}
      <p
        className={`text-[13px] leading-snug mb-2 ${card.completed ? 'line-through text-zinc-400' : 'text-zinc-100'}`}
      >
        {card.title}
      </p>

      {/* Footer: prioridad + estado bloqueo */}
      <div className="flex items-center gap-2">
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
  );
}

const nodeTypes = { card: CardNode };

// ─── Algoritmo de layout por columnas ────────────────────────────────────────

function computeLayout(cards: GraphCard[]): Node[] {
  // Agrupar por lista, ordenadas por posición de lista
  const listOrder = new Map<string, number>();
  for (const c of cards) {
    if (!listOrder.has(c.listId)) {
      listOrder.set(c.listId, c.listPosition);
    }
  }

  // Ordenar listas
  const sortedListIds = [...listOrder.entries()].sort(([, a], [, b]) => a - b).map(([id]) => id);

  // Agrupar cards por lista
  const byList = new Map<string, GraphCard[]>();
  for (const id of sortedListIds) byList.set(id, []);
  for (const c of cards) byList.get(c.listId)?.push(c);

  const nodes: Node[] = [];
  let x = 0;

  for (const listId of sortedListIds) {
    const listCards = byList.get(listId) ?? [];
    listCards.forEach((card, rowIdx) => {
      nodes.push({
        id: card.id,
        type: 'card',
        position: {
          x,
          y: rowIdx * (NODE_HEIGHT + ROW_GAP),
        },
        data: { card },
        draggable: true,
      });
    });
    x += NODE_WIDTH + COL_GAP;
  }

  return nodes;
}

// ─── Transformar edges de API a React Flow ────────────────────────────────────

function buildEdges(apiEdges: GraphEdge[], cards: GraphCard[]): Edge[] {
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  return apiEdges.map((e) => {
    const blocking = cardMap.get(e.blockingCardId);
    const blocked = cardMap.get(e.blockedCardId);
    const isActive = blocking && !blocking.completed; // la dependencia sigue activa

    return {
      id: e.id,
      source: e.blockingCardId,
      target: e.blockedCardId,
      type: 'smoothstep',
      animated: !!isActive,
      style: {
        stroke: isActive ? '#f59e0b' : '#22c55e',
        strokeWidth: isActive ? 2 : 1.5,
        strokeDasharray: isActive ? undefined : '5 3',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isActive ? '#f59e0b' : '#22c55e',
        width: 18,
        height: 18,
      },
      label: isActive ? 'bloquea' : 'completada',
      labelStyle: {
        fill: isActive ? '#f59e0b' : '#22c55e',
        fontSize: 9,
        fontFamily: 'monospace',
      },
      labelBgStyle: {
        fill: '#18181b',
        fillOpacity: 0.85,
      },
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
    const computedNodes = computeLayout(graph.cards);
    const computedEdges = buildEdges(graph.edges, graph.cards);
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [graph, setNodes, setEdges]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!graph) return null;
    const blockedCount = graph.cards.filter(
      (c) => c.blockedByPendingCount > 0 && !c.completed
    ).length;
    const completedCount = graph.cards.filter((c) => c.completed).length;
    const activeEdges = graph.edges.filter((e) => {
      const blocking = graph.cards.find((c) => c.id === e.blockingCardId);
      return blocking && !blocking.completed;
    }).length;
    return {
      total: graph.cards.length,
      blocked: blockedCount,
      completed: completedCount,
      activeEdges,
    };
  }, [graph]);

  const handleBack = () => {
    router.push(`/dashboard/workspaces/${workspaceId}/boards/${boardId}`);
  };

  // ── Estado de carga ────────────────────────────────────────────────────────
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
        {/* Header */}
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

  // ── Mapa con React Flow ────────────────────────────────────────────────────
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

        {/* Stats + refresh */}
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
              <div className="flex items-center gap-1.5 text-zinc-400">
                <span>
                  {graph.edges.length} dependencia{graph.edges.length !== 1 ? 's' : ''}
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
      <div className="px-6 py-2.5 flex items-center gap-6 border-b border-zinc-800 bg-zinc-900/50 font-mono text-xs text-zinc-400 flex-shrink-0">
        <span className="font-medium text-zinc-300">Leyenda:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 bg-amber-400" style={{ backgroundImage: 'none' }} />
          <span>Dependencia activa (anima)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-8 h-0.5 bg-emerald-400"
            style={{
              backgroundSize: '8px 4px',
              backgroundImage:
                'repeating-linear-gradient(90deg, #22c55e 0, #22c55e 5px, transparent 5px, transparent 8px)',
            }}
          />
          <span>Dependencia resuelta</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-amber-500/60 bg-amber-950/60" />
          <span>Card bloqueada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-emerald-500/50 bg-emerald-950/60" />
          <span>Card completada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-zinc-600 bg-zinc-900" />
          <span>Card pendiente</span>
        </div>
      </div>

      {/* React Flow canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 1.2 }}
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{ type: 'smoothstep' }}
          proOptions={{ hideAttribution: true }}
          colorMode="dark"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#3f3f46" />
          <Controls
            style={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: 4 }}
          />
          <MiniMap
            nodeColor={(node) => {
              const card = (node.data as CardNodeData).card;
              if (card.completed) return '#22c55e';
              if (card.blockedByPendingCount > 0) return '#f59e0b';
              return '#71717a';
            }}
            style={{ background: '#18181b', border: '1px solid #3f3f46' }}
            maskColor="rgba(0,0,0,0.4)"
          />

          {/* Panel: instrucciones */}
          <Panel position="bottom-center">
            <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/90 border border-zinc-700 text-xs text-zinc-400 font-mono backdrop-blur">
              <span>Arrastra para mover nodos</span>
              <span className="text-zinc-600">·</span>
              <span>Rueda para zoom</span>
              <span className="text-zinc-600">·</span>
              <span>Ctrl + scroll para navegar</span>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
