// apps/web/src/components/documents/CollaborativeEditor.tsx
'use client';

import { useEditor, EditorContent, BubbleMenu, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { common, createLowlight } from 'lowlight';
import * as Y from 'yjs';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { socketService } from '@/services/socketService';
import { useDocumentStore } from '@/stores/documentStore';
import { useDocumentAutoSave } from '@/hooks/useDocumentAutoSave';
import {
  Awareness,
  encodeAwarenessUpdate as awarenessEncodeUpdate,
  applyAwarenessUpdate as awarenessApplyUpdate,
} from 'y-protocols/awareness';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Code2,
  List,
  ListOrdered,
  ListChecks,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  Undo,
  Redo,
  Save,
  Check,
  Eye,
  Highlighter,
  Table as TableIcon,
  Link as LinkIcon,
  IndentIncrease,
  IndentDecrease,
  ChevronDown,
  Plus,
  Trash2,
  MessageSquare,
  X,
  ExternalLink,
} from 'lucide-react';
import { CommentMarkExtension } from './CommentMarkExtension';
import { DocumentCommentsSidebar, CommentGutterIndicators } from './DocumentCommentsSidebar';
import {
  useDocumentCommentStore,
  selectSidebarOpen,
  selectDocumentComments,
  selectActiveCommentId,
} from '@/stores/documentCommentStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

const lowlight = createLowlight(common);

// ── Design tokens ─────────────────────────────────────────────────────────────


// ── Highlight colour palette ──────────────────────────────────────────────────
const HIGHLIGHT_COLORS = [
  { label: 'Amarillo', value: '#ca8a04' },
  { label: 'Verde',    value: '#16a34a' },
  { label: 'Azul',     value: '#2563eb' },
  { label: 'Rosa',     value: '#db2777' },
  { label: 'Naranja',  value: '#ea580c' },
  { label: 'Violeta',  value: '#9333ea' },
  { label: 'Rojo',     value: '#dc2626' },
  { label: 'Cyan',     value: '#0891b2' },
];

// ── Custom Indent extension ───────────────────────────────────────────────────
// Handles indent/outdent on non-list paragraphs/headings via Tab / Shift+Tab
const IndentExtension = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => parseInt(el.getAttribute('data-indent') ?? '0', 10),
            renderHTML: (attrs) => {
              if (!attrs.indent) return {};
              return {
                'data-indent': attrs.indent,
                style: `padding-left: ${attrs.indent * 2}rem`,
              };
            },
          },
        },
      },
    ];
  },
  addKeyboardShortcuts() {
    const indent = () => {
      const { state, dispatch } = this.editor.view;
      const { selection } = state;
      const node = state.doc.nodeAt(selection.from);
      const type = state.doc.resolve(selection.from).parent.type.name;
      if (type !== 'paragraph' && type !== 'heading') return false;
      const parentNode = state.doc.resolve(selection.from).parent;
      const current = (parentNode.attrs.indent as number) ?? 0;
      if (current >= 8) return false;
      this.editor
        .chain()
        .updateAttributes(type, { indent: current + 1 })
        .run();
      return true;
    };
    const outdent = () => {
      const { state } = this.editor.view;
      const { selection } = state;
      const type = state.doc.resolve(selection.from).parent.type.name;
      if (type !== 'paragraph' && type !== 'heading') return false;
      const parentNode = state.doc.resolve(selection.from).parent;
      const current = (parentNode.attrs.indent as number) ?? 0;
      if (current <= 0) return false;
      this.editor
        .chain()
        .updateAttributes(type, { indent: current - 1 })
        .run();
      return true;
    };
    return { Tab: indent, 'Shift-Tab': outdent };
  },
});

// ── TableCell with colwidth attribute ────────────────────────────────────────
// colwidth is stored as a percentage (0–100) so the table stays proportional
// and never escapes its container regardless of viewport width.
const ResizableTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute('data-colwidth');
          return w ? parseFloat(w) : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.colwidth) return {};
          return {
            'data-colwidth': attrs.colwidth,
            style: `width: ${attrs.colwidth}%; min-width: ${MIN_COL_WIDTH}px`,
          };
        },
      },
    };
  },
});

const ResizableTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute('data-colwidth');
          return w ? parseFloat(w) : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.colwidth) return {};
          return {
            'data-colwidth': attrs.colwidth,
            style: `width: ${attrs.colwidth}%; min-width: ${MIN_COL_WIDTH}px`,
          };
        },
      },
    };
  },
});

// ── TableRow with rowHeight attribute ─────────────────────────────────────────
const ResizableTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      rowHeight: {
        default: null,
        parseHTML: (el) => {
          const h = el.getAttribute('data-rowheight');
          return h ? parseInt(h, 10) : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.rowHeight) return {};
          return {
            'data-rowheight': attrs.rowHeight,
            style: `height: ${attrs.rowHeight}px`,
          };
        },
      },
    };
  },
});

// ── Table resize overlay ──────────────────────────────────────────────────────
// Renders drag handles on every column border (left+right outer, all inner)
// and on every row's bottom border. Purely visual overlay — no ProseMirror
// node views needed.
const MIN_COL_WIDTH = 40;
const MIN_ROW_HEIGHT = 28;

function TableResizeOverlay({
  editor,
  containerRef,
  scrollRef,
  canEdit,
}: {
  editor: any;
  containerRef: React.RefObject<HTMLDivElement>;
  scrollRef: React.RefObject<HTMLDivElement>;
  canEdit: boolean;
}) {
  // colHandles: x positions of each column border (left outer + all inner + right outer)
  const [colHandles, setColHandles] = useState<
    { x: number; top: number; height: number; colIndex: number }[]
  >([]);
  // rowHandles: y positions of each row's bottom border
  const [rowHandles, setRowHandles] = useState<
    { y: number; left: number; width: number; rowIndex: number }[]
  >([]);
  const [activeTable, setActiveTable] = useState<Element | null>(null);

  // Re-scan the DOM for column/row handles whenever content changes or mouse enters table
  const scan = useCallback(
    (table: Element) => {
      const container = containerRef.current;
      if (!container) return;
      const cr = container.getBoundingClientRect();
      const scrollTop = scrollRef.current?.scrollTop ?? 0;

      // ── Column handles ────────────────────────────────────────────────────
      const firstRow = table.querySelector('tr');
      if (!firstRow) return;
      const cells = Array.from(firstRow.querySelectorAll('th, td'));
      if (cells.length === 0) return;

      const tableRect = table.getBoundingClientRect();
      const relTop = tableRect.top - cr.top + scrollTop;
      const relHeight = tableRect.height;

      const newColHandles: typeof colHandles = [];
      cells.forEach((cell, i) => {
        const cellRect = cell.getBoundingClientRect();
        // Left edge of first cell = left outer border
        if (i === 0) {
          newColHandles.push({
            x: cellRect.left - cr.left,
            top: relTop,
            height: relHeight,
            colIndex: -1, // left outer — resize first col
          });
        }
        // Right edge of every cell = inner border (or right outer for last)
        newColHandles.push({
          x: cellRect.right - cr.left,
          top: relTop,
          height: relHeight,
          colIndex: i,
        });
      });
      setColHandles(newColHandles);

      // ── Row handles ───────────────────────────────────────────────────────
      const rows = Array.from(table.querySelectorAll('tr'));
      const newRowHandles: typeof rowHandles = [];
      rows.forEach((row, i) => {
        const rowRect = row.getBoundingClientRect();
        newRowHandles.push({
          y: rowRect.bottom - cr.top + scrollTop,
          left: tableRect.left - cr.left,
          width: tableRect.width,
          rowIndex: i,
        });
      });
      setRowHandles(newRowHandles);
    },
    [containerRef, scrollRef]
  );

  // Listen for mousemove inside the editor to detect when to show handles
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !canEdit) return;
    const onMove = (e: MouseEvent) => {
      const table = (e.target as Element).closest?.('table');
      if (table) {
        setActiveTable(table);
        scan(table);
      }
    };
    container.addEventListener('mousemove', onMove);
    return () => container.removeEventListener('mousemove', onMove);
  }, [containerRef, canEdit, scan]);

  // Re-scan when editor content updates (column/row added)
  useEffect(() => {
    if (!editor || !canEdit) return;
    const onUpdate = () => {
      if (activeTable) {
        // Table element may have been replaced; re-query
        const container = containerRef.current;
        if (!container) return;
        const tables = container.querySelectorAll('table');
        // Find table still in DOM
        let found: Element | null = null;
        tables.forEach((t) => {
          if (t === activeTable || t.contains(activeTable as Node)) found = t;
        });
        if (!found && tables.length > 0) found = tables[tables.length - 1];
        if (found) {
          setActiveTable(found);
          scan(found);
        } else {
          setColHandles([]);
          setRowHandles([]);
          setActiveTable(null);
        }
      }
    };
    editor.on('update', onUpdate);
    return () => editor.off('update', onUpdate);
  }, [editor, canEdit, activeTable, containerRef, scan]);

  if (!canEdit || (colHandles.length === 0 && rowHandles.length === 0)) return null;

  return (
    <>
      {colHandles.map((h, idx) => (
        <ColResizeHandle
          key={`col-${idx}`}
          handle={h}
          editor={editor}
          activeTable={activeTable}
          containerRef={containerRef}
          scrollRef={scrollRef}
          onResizeDone={() => activeTable && scan(activeTable)}
        />
      ))}
      {rowHandles.map((h, idx) => (
        <RowResizeHandle
          key={`row-${idx}`}
          handle={h}
          editor={editor}
          activeTable={activeTable}
          containerRef={containerRef}
          scrollRef={scrollRef}
          onResizeDone={() => activeTable && scan(activeTable)}
        />
      ))}
    </>
  );
}

// ── Column resize handle ──────────────────────────────────────────────────────
function ColResizeHandle({
  handle,
  editor,
  activeTable,
  containerRef,
  scrollRef,
  onResizeDone,
}: {
  handle: { x: number; top: number; height: number; colIndex: number };
  editor: any;
  activeTable: Element | null;
  containerRef: React.RefObject<HTMLDivElement>;
  scrollRef: React.RefObject<HTMLDivElement>;
  onResizeDone: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  // Widths in percentage at drag start
  const startPcts = useRef<number[]>([]);
  // Total pixel width of the table at drag start (used to convert px delta → %)
  const tablePixelWidth = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!activeTable) return;

      const firstRow = activeTable.querySelector('tr');
      if (!firstRow) return;
      const cells = Array.from(firstRow.querySelectorAll('th, td'));
      const tableRect = activeTable.getBoundingClientRect();
      tablePixelWidth.current = tableRect.width;

      startX.current = e.clientX;
      // Capture current widths as percentages of the table
      startPcts.current = cells.map(
        (c) => ((c as HTMLElement).getBoundingClientRect().width / tablePixelWidth.current) * 100
      );
      setDragging(true);

      const onMove = (ev: MouseEvent) => {
        if (!activeTable || tablePixelWidth.current === 0) return;
        const deltaPx = ev.clientX - startX.current;
        const deltaPct = (deltaPx / tablePixelWidth.current) * 100;
        const colIndex = handle.colIndex;
        const numCols = startPcts.current.length;

        // Minimum column width as a percentage
        const minPct = (MIN_COL_WIDTH / tablePixelWidth.current) * 100;

        if (colIndex === -1) {
          // Left outer border → resize first column and compensate with second
          const leftNeighbor = 1; // column that absorbs the change
          if (numCols < 2) return;
          const rawLeft = startPcts.current[0] - deltaPct;
          const clampedLeft = Math.max(
            minPct,
            Math.min(rawLeft, startPcts.current[0] + startPcts.current[leftNeighbor] - minPct)
          );
          const diff = clampedLeft - startPcts.current[0];
          const newNeighbor = Math.max(minPct, startPcts.current[leftNeighbor] - diff);
          applyColWidths(editor, activeTable, [
            { colIndex: 0, pct: clampedLeft },
            { colIndex: leftNeighbor, pct: newNeighbor },
          ]);
        } else {
          // Right border of colIndex → swap width with right neighbor only
          const rightNeighbor = colIndex + 1;
          if (rightNeighbor >= numCols) return; // right outer border — no neighbor to swap with
          const rawLeft = startPcts.current[colIndex] + deltaPct;
          const combined = startPcts.current[colIndex] + startPcts.current[rightNeighbor];
          const clampedLeft = Math.max(minPct, Math.min(rawLeft, combined - minPct));
          const newNeighbor = Math.max(minPct, combined - clampedLeft);
          applyColWidths(editor, activeTable, [
            { colIndex: colIndex, pct: clampedLeft },
            { colIndex: rightNeighbor, pct: newNeighbor },
          ]);
        }
      };

      const onUp = () => {
        setDragging(false);
        onResizeDone();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [activeTable, editor, handle, onResizeDone]
  );

  const HANDLE_W = 8;
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: handle.x - HANDLE_W / 2,
        top: handle.top,
        width: HANDLE_W,
        height: handle.height,
        zIndex: 25,
        cursor: 'col-resize',
      }}
      className={`group ${dragging ? 'bg-accent/40' : 'hover:bg-accent/30'} transition-colors`}
    >
      {/* Visible thin line in center */}
      <div
        className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 transition-colors ${
          dragging ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/60'
        }`}
      />
    </div>
  );
}

// ── Row resize handle ─────────────────────────────────────────────────────────
function RowResizeHandle({
  handle,
  editor,
  activeTable,
  containerRef,
  scrollRef,
  onResizeDone,
}: {
  handle: { y: number; left: number; width: number; rowIndex: number };
  editor: any;
  activeTable: Element | null;
  containerRef: React.RefObject<HTMLDivElement>;
  scrollRef: React.RefObject<HTMLDivElement>;
  onResizeDone: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!activeTable) return;

      const rows = Array.from(activeTable.querySelectorAll('tr'));
      const targetRow = rows[handle.rowIndex];
      if (!targetRow) return;

      startY.current = e.clientY;
      startHeight.current = targetRow.getBoundingClientRect().height;
      setDragging(true);

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY.current;
        const newHeight = Math.max(MIN_ROW_HEIGHT, startHeight.current + delta);
        applyRowHeight(editor, activeTable, handle.rowIndex, newHeight);
      };

      const onUp = () => {
        setDragging(false);
        onResizeDone();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [activeTable, editor, handle, onResizeDone]
  );

  const HANDLE_H = 8;
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: handle.left,
        top: handle.y - HANDLE_H / 2,
        width: handle.width,
        height: HANDLE_H,
        zIndex: 25,
        cursor: 'row-resize',
      }}
      className={`group ${dragging ? 'bg-accent/40' : 'hover:bg-accent/30'} transition-colors`}
    >
      <div
        className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 transition-colors ${
          dragging ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/60'
        }`}
      />
    </div>
  );
}

// ── Helpers: apply width/height via ProseMirror transaction ──────────────────
// `pct` is a percentage (0–100) stored with 2 decimal places.
// Apply multiple column widths in a single transaction to avoid cascading reflows.
function applyColWidths(editor: any, table: Element, changes: { colIndex: number; pct: number }[]) {
  const { state, dispatch } = editor.view;
  const { doc, tr } = state;

  const updates: { pos: number; attrs: any }[] = [];
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'tableRow') {
      let cellIdx = 0;
      node.forEach((cell: any, offset: number) => {
        const change = changes.find((c) => c.colIndex === cellIdx);
        if (change) {
          updates.push({
            pos: pos + 1 + offset,
            attrs: { ...cell.attrs, colwidth: parseFloat(change.pct.toFixed(2)) },
          });
        }
        cellIdx++;
      });
    }
  });

  if (updates.length === 0) return;
  let transaction = tr;
  updates.forEach(({ pos, attrs }) => {
    const node = doc.nodeAt(pos);
    if (node) transaction = transaction.setNodeMarkup(pos, undefined, attrs);
  });
  dispatch(transaction);
}

function applyRowHeight(editor: any, table: Element, rowIndex: number, height: number) {
  const { state, dispatch } = editor.view;
  const { doc, tr } = state;

  // Apply height only to the specific row being resized
  const updates: { pos: number; attrs: any }[] = [];
  let currentRowIndex = 0;
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'tableRow') {
      if (currentRowIndex === rowIndex) {
        updates.push({ pos, attrs: { ...node.attrs, rowHeight: Math.round(height) } });
      }
      currentRowIndex++;
    }
  });

  if (updates.length === 0) return;
  let transaction = tr;
  updates.forEach(({ pos, attrs }) => {
    const node = doc.nodeAt(pos);
    if (node) transaction = transaction.setNodeMarkup(pos, undefined, attrs);
  });
  dispatch(transaction);
}

interface CollaborativeEditorProps {
  documentId: string;
  workspaceId: string;
  currentUser: { id: string; name: string; color: string };
  canEdit: boolean;
}

// ── Icon wrapper for responsive sizing ────────────────────────────────────────
function ResponsiveIcon({ Icon, className = '' }: { Icon: any; className?: string }) {
  return <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${className}`} />;
}

// ── Reusable toolbar button ───────────────────────────────────────────────────
function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '28px', height: '28px', borderRadius: '5px', flexShrink: 0,
        background: isActive ? C.accent : hovered ? C.hover : 'transparent',
        border: `1px solid ${isActive ? C.accent : hovered ? C.border2 : 'transparent'}`,
        color: isActive ? '#fff' : hovered ? C.text : C.text3,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: '1px', height: '18px', background: C.border2, margin: '0 3px', flexShrink: 0 }} />;
}

// ── Highlight colour picker button ────────────────────────────────────────────
function HighlightPicker({ editor }: { editor: any }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = editor.isActive('highlight');

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const [hBtn, setHBtn] = useState(false);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        onMouseEnter={() => setHBtn(true)}
        onMouseLeave={() => setHBtn(false)}
        title="Color de resaltado"
        style={{
          display: 'flex', alignItems: 'center', gap: '2px',
          padding: '0 5px', height: '28px', borderRadius: '5px',
          background: isActive ? C.accent : hBtn ? C.hover : 'transparent',
          border: `1px solid ${isActive ? C.accent : hBtn ? C.border2 : 'transparent'}`,
          color: isActive ? '#fff' : hBtn ? C.text : C.text3,
          cursor: 'pointer', transition: 'all 0.1s',
        }}
      >
        <Highlighter style={{ width: '13px', height: '13px' }} />
        <ChevronDown style={{ width: '10px', height: '10px', opacity: 0.6 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
          background: C.surface, border: `1px solid ${C.border2}`,
          borderRadius: '9px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          padding: '12px', width: '180px',
        }}>
          <p style={{ fontSize: '10px', color: C.text4, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
            Color de resaltado
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '10px' }}>
            {HIGHLIGHT_COLORS.map((hc) => (
              <button
                key={hc.value}
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHighlight({ color: hc.value }).run(); setOpen(false); }}
                title={hc.label}
                style={{ backgroundColor: hc.value, width: '32px', height: '32px', borderRadius: '5px', border: '2px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderTop: `1px solid ${C.border}`, paddingTop: '8px' }}>
            <span style={{ fontSize: '10px', color: C.text4, flexShrink: 0 }}>Custom:</span>
            <input
              type="color"
              defaultValue="#fef08a"
              onInput={(e) => { editor.chain().focus().setHighlight({ color: (e.target as HTMLInputElement).value }).run(); }}
              style={{ width: '28px', height: '22px', cursor: 'pointer', border: `1px solid ${C.border2}`, borderRadius: '4px', background: C.bg2, padding: 0 }}
              title="Color personalizado"
            />
          </div>
          {isActive && (
            <button
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); setOpen(false); }}
              style={{ marginTop: '8px', width: '100%', fontSize: '10px', color: C.red, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '0 2px' }}
            >
              Quitar resaltado
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Table hover buttons (add column / add row) ───────────────────────────────
// Detects mouse proximity to the table edges (within SENSE_PX) so the buttons
// appear before the user reaches the exact edge. The outer wrapper intercepts
// pointer events only in the button zones so the editor remains fully usable.
const SENSE_PX = 48; // px beyond table edge where detection activates

function TableHoverButtons({
  editor,
  containerRef,
  scrollRef,
}: {
  editor: any;
  containerRef: React.RefObject<HTMLDivElement>;
  scrollRef: React.RefObject<HTMLDivElement>;
}) {
  const [tablePos, setTablePos] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTableRef = useRef<Element | null>(null);

  // Compute position relative to containerRef (position:relative parent),
  // accounting for the scrollable ancestor's scroll offset.
  const measure = useCallback(
    (table: Element) => {
      const container = containerRef.current;
      if (!container) return;
      // getBoundingClientRect gives viewport-relative coords.
      // Subtracting container's rect gives coords relative to the container,
      // then we add the container's own scrollTop (always 0 here since it
      // doesn't scroll) plus the scrollable parent's scrollTop so that the
      // absolute-positioned buttons follow the page when scrolled.
      const cr = container.getBoundingClientRect();
      const tr = table.getBoundingClientRect();
      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      setTablePos({
        top: tr.top - cr.top + scrollTop,
        left: tr.left - cr.left,
        width: tr.width,
        height: tr.height,
      });
    },
    [containerRef, scrollRef]
  );

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setTablePos(null);
      currentTableRef.current = null;
    }, 200);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      // Walk up the DOM to find the closest table
      const table = (e.target as Element).closest?.('table');

      if (table) {
        // Mouse is directly over the table
        cancelHide();
        if (currentTableRef.current !== table) {
          currentTableRef.current = table;
        }
        measure(table);
        return;
      }

      // Mouse is NOT on the table — check proximity to the last known table
      if (currentTableRef.current) {
        const tr = currentTableRef.current.getBoundingClientRect();

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        const nearRight =
          mouseX >= tr.right - 8 &&
          mouseX <= tr.right + SENSE_PX &&
          mouseY >= tr.top - 8 &&
          mouseY <= tr.bottom + 8;

        const nearBottom =
          mouseY >= tr.bottom - 8 &&
          mouseY <= tr.bottom + SENSE_PX &&
          mouseX >= tr.left - 8 &&
          mouseX <= tr.right + 8;

        if (nearRight || nearBottom) {
          cancelHide();
          measure(currentTableRef.current);
          return;
        }
      }

      // Not near any table — schedule hide
      scheduleHide();
    };

    container.addEventListener('mousemove', onMove);
    return () => {
      container.removeEventListener('mousemove', onMove);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [containerRef, measure, cancelHide, scheduleHide]);

  if (!editor || !tablePos) return null;

  return (
    <>
      {/* Add column — vertical line on right edge with centered + */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          setTablePos(null);
          currentTableRef.current = null;
          editor.chain().focus().addColumnAfter().run();
        }}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
        title="Añadir columna"
        style={{
          position: 'absolute',
          top: tablePos.top,
          left: tablePos.left + tablePos.width + 2,
          width: 20,
          height: tablePos.height,
          zIndex: 30,
        }}
        className="group flex items-center justify-center cursor-pointer border-none bg-transparent p-0 outline-none"
      >
        {/* thin vertical line */}
        <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border/40 group-hover:bg-accent/60 transition-colors duration-200" />
        {/* + badge at center */}
        <span
          className="relative flex items-center justify-center w-5 h-5 rounded-full bg-background border border-border/50 text-text-muted group-hover:border-accent group-hover:text-accent group-hover:bg-accent/10 transition-all duration-200 shadow-sm opacity-60 group-hover:opacity-100 scale-90 group-hover:scale-100"
          style={{ fontSize: 13, lineHeight: 1 }}
        >
          <Plus className="w-3 h-3" />
        </span>
      </button>

      {/* Add row — horizontal line on bottom edge with centered + */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          setTablePos(null);
          currentTableRef.current = null;
          editor.chain().focus().addRowAfter().run();
        }}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
        title="Añadir fila"
        style={{
          position: 'absolute',
          top: tablePos.top + tablePos.height + 2,
          left: tablePos.left,
          width: tablePos.width,
          height: 20,
          zIndex: 30,
        }}
        className="group flex items-center justify-center cursor-pointer border-none bg-transparent p-0 outline-none"
      >
        {/* thin horizontal line */}
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border/40 group-hover:bg-accent/60 transition-colors duration-200" />
        {/* + badge at center */}
        <span
          className="relative flex items-center justify-center w-5 h-5 rounded-full bg-background border border-border/50 text-text-muted group-hover:border-accent group-hover:text-accent group-hover:bg-accent/10 transition-all duration-200 shadow-sm opacity-60 group-hover:opacity-100 scale-90 group-hover:scale-100"
          style={{ fontSize: 13, lineHeight: 1 }}
        >
          <Plus className="w-3 h-3" />
        </span>
      </button>
    </>
  );
}

function TableMenuItem({ children, onMouseDown, danger }: { children: React.ReactNode; onMouseDown: (e: React.MouseEvent) => void; danger?: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button
      onMouseDown={onMouseDown}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '7px',
        padding: '6px 10px', borderRadius: '6px', textAlign: 'left',
        fontSize: '12.5px', background: h ? C.hover : 'transparent', border: 'none',
        color: danger ? (h ? C.red : C.text3) : (h ? C.text : C.text2),
        cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  );
}

// ── Table context menu ────────────────────────────────────────────────────────
function TableMenu({ editor, t }: { editor: any; t: any }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inTable = editor.isActive('table');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const run = (cmd: () => void) => {
    cmd();
    setOpen(false);
  };

  const [hBtn, setHBtn] = useState(false);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        onMouseEnter={() => setHBtn(true)}
        onMouseLeave={() => setHBtn(false)}
        title="Opciones de tabla"
        style={{
          display: 'flex', alignItems: 'center', gap: '2px',
          padding: '0 5px', height: '28px', borderRadius: '5px',
          background: inTable ? C.accent : hBtn ? C.hover : 'transparent',
          border: `1px solid ${inTable ? C.accent : hBtn ? C.border2 : 'transparent'}`,
          color: inTable ? '#fff' : hBtn ? C.text : C.text3,
          cursor: 'pointer', transition: 'all 0.1s',
        }}
      >
        <TableIcon style={{ width: '13px', height: '13px' }} />
        <ChevronDown style={{ width: '10px', height: '10px', opacity: 0.6 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
          background: C.surface, border: `1px solid ${C.border2}`,
          borderRadius: '9px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          padding: '4px', width: '210px',
        }}>
          <TableMenuItem onMouseDown={(e) => { e.preventDefault(); run(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()); }}>
            <Plus style={{ width: '12px', height: '12px', color: C.accent }} /> Insertar tabla (3×3)
          </TableMenuItem>

          {inTable && (
            <>
              <div style={{ height: '1px', background: C.border, margin: '4px 0' }} />
              <p style={{ fontSize: '10px', color: C.text4, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '2px 10px 4px' }}>Columnas</p>
              <TableMenuItem onMouseDown={(e) => { e.preventDefault(); run(() => editor.chain().focus().addColumnBefore().run()); }}>+ Columna a la izquierda</TableMenuItem>
              <TableMenuItem onMouseDown={(e) => { e.preventDefault(); run(() => editor.chain().focus().addColumnAfter().run()); }}>+ Columna a la derecha</TableMenuItem>
              <TableMenuItem danger onMouseDown={(e) => { e.preventDefault(); run(() => editor.chain().focus().deleteColumn().run()); }}>
                <Trash2 style={{ width: '11px', height: '11px' }} /> {t.editor_table_delete_column}
              </TableMenuItem>

              <div style={{ height: '1px', background: C.border, margin: '4px 0' }} />
              <p style={{ fontSize: '10px', color: C.text4, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '2px 10px 4px' }}>Filas</p>
              <TableMenuItem onMouseDown={(e) => { e.preventDefault(); run(() => editor.chain().focus().addRowBefore().run()); }}>+ Fila arriba</TableMenuItem>
              <TableMenuItem onMouseDown={(e) => { e.preventDefault(); run(() => editor.chain().focus().addRowAfter().run()); }}>+ Fila abajo</TableMenuItem>
              <TableMenuItem danger onMouseDown={(e) => { e.preventDefault(); run(() => editor.chain().focus().deleteRow().run()); }}>
                <Trash2 style={{ width: '11px', height: '11px' }} /> {t.editor_table_delete_row}
              </TableMenuItem>

              <div style={{ height: '1px', background: C.border, margin: '4px 0' }} />
              <TableMenuItem onMouseDown={(e) => { e.preventDefault(); run(() => editor.chain().focus().toggleHeaderRow().run()); }}>⇅ Alternar fila encabezado</TableMenuItem>
              <TableMenuItem danger onMouseDown={(e) => { e.preventDefault(); run(() => editor.chain().focus().deleteTable().run()); }}>
                <Trash2 style={{ width: '11px', height: '11px' }} /> {t.editor_table_delete_table}
              </TableMenuItem>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helper para formatear tiempo relativo ─────────────────────────────────────
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return 'ahora mismo';
  if (seconds < 60) return 'hace un momento';

  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return 'hace 1 minuto';
  if (minutes < 60) return `hace ${minutes} minutos`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'hace 1 hora';
  return `hace ${hours} horas`;
}

function BubbleBtn({ children, onMouseDown, active, title }: { children: React.ReactNode; onMouseDown: (e: React.MouseEvent) => void; active?: boolean; title: string }) {
  const [h, setH] = useState(false);
  return (
    <button
      onMouseDown={onMouseDown}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '24px', height: '24px', borderRadius: '4px',
        background: active ? C.accent : h ? C.hover : 'transparent',
        border: 'none', color: active ? '#fff' : h ? C.text : C.text3,
        cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  );
}

function CommentsBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      title={active ? 'Cerrar comentarios' : 'Abrir comentarios'}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '0 10px', height: '28px', borderRadius: '5px', fontSize: '12px',
        background: active ? `${C.accent}18` : h ? C.hover : 'transparent',
        border: `1px solid ${active ? `${C.accent}50` : h ? C.border2 : 'transparent'}`,
        color: active ? C.accent : h ? C.text2 : C.text3,
        cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      <MessageSquare style={{ width: '13px', height: '13px' }} />
    </button>
  );
}

function SaveBtn({ onClick, isSaving }: { onClick: () => void; isSaving: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={isSaving}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      title="Guardar manualmente (Ctrl+S)"
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '0 10px', height: '28px', borderRadius: '5px', fontSize: '12px', fontWeight: 500,
        background: isSaving ? `${C.green}18` : h ? C.hover : 'transparent',
        border: `1px solid ${isSaving ? `${C.green}40` : h ? C.border2 : C.border}`,
        color: isSaving ? C.green : h ? C.text : C.text2,
        cursor: isSaving ? 'default' : 'pointer', transition: 'all 0.1s',
      }}
    >
      {isSaving
        ? <><Check style={{ width: '12px', height: '12px' }} /> Guardado</>
        : <><Save style={{ width: '12px', height: '12px' }} /> Ctrl+S</>
      }
    </button>
  );
}

// ── Link input popup ─────────────────────────────────────────────────────────
function LinkInput({
  editor,
  wrapperRef,
  onClose,
}: {
  editor: any;
  wrapperRef: React.RefObject<HTMLDivElement>;
  onClose: () => void;
}) {
  const isActive = editor.isActive('link');
  const [url, setUrl] = useState<string>(() =>
    isActive ? (editor.getAttributes('link').href ?? '') : ''
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the input as soon as the popup opens
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Close on outside mousedown
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        wrapperRef.current && !wrapperRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose, wrapperRef]);

  const apply = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    editor.chain().focus().setLink({ href, target: '_blank' }).run();
    onClose();
  };

  const remove = () => {
    editor.chain().focus().unsetLink().run();
    onClose();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); apply(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const canApply = url.trim().length > 0;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        zIndex: 100,
        width: '292px',
        background: C.surface,
        border: `1px solid ${C.border2}`,
        borderRadius: '10px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(56,182,255,0.06)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{
            width: '22px', height: '22px', borderRadius: '5px', flexShrink: 0,
            background: 'rgba(56,182,255,0.1)', border: `1px solid ${C.border2}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <LinkIcon style={{ width: '11px', height: '11px', color: C.accent }} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>
            {isActive ? 'Editar enlace' : 'Insertar enlace'}
          </span>
        </div>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onClose(); }}
          style={{
            width: '22px', height: '22px', borderRadius: '4px',
            background: 'transparent', border: 'none',
            color: C.text3, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3; }}
        >
          <X style={{ width: '11px', height: '11px' }} />
        </button>
      </div>

      {/* URL input */}
      <input
        ref={inputRef}
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKey}
        placeholder="https://example.com"
        style={{
          width: '100%',
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '12.5px',
          color: C.text,
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = C.border2)}
        onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
      />

      {/* Hint */}
      <p style={{ margin: 0, fontSize: '11px', color: C.text4, lineHeight: 1.5 }}>
        Presiona <kbd style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', background: C.hover, border: `1px solid ${C.border}`, color: C.text3 }}>Enter</kbd> para aplicar •&nbsp;
        <kbd style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', background: C.hover, border: `1px solid ${C.border}`, color: C.text3 }}>Esc</kbd> para cancelar
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {isActive && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); remove(); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '5px 9px', borderRadius: '5px',
              fontSize: '11.5px', fontFamily: 'inherit',
              background: 'transparent', color: C.red,
              border: `1px solid rgba(239,68,68,0.3)`,
              cursor: 'pointer', transition: 'border-color 0.15s',
              marginRight: 'auto',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)')}
          >
            <Minus style={{ width: '11px', height: '11px' }} />
            Quitar
          </button>
        )}

        {isActive && url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '5px 9px', borderRadius: '5px',
              fontSize: '11.5px', fontFamily: 'inherit',
              background: 'transparent', color: C.text3,
              border: `1px solid ${C.border}`,
              cursor: 'pointer', textDecoration: 'none',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.text2; (e.currentTarget as HTMLElement).style.borderColor = C.border2; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.text3; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
          >
            <ExternalLink style={{ width: '10px', height: '10px' }} />
            Abrir
          </a>
        )}

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); apply(); }}
          disabled={!canApply}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '5px 12px', borderRadius: '5px',
            fontSize: '11.5px', fontWeight: 600, fontFamily: 'inherit',
            background: canApply ? C.accent : C.border,
            color: canApply ? '#080c14' : C.text3,
            border: 'none', cursor: canApply ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          <Check style={{ width: '11px', height: '11px' }} />
          Aplicar
        </button>
      </div>
    </div>
  );
}

// ── Main toolbar ──────────────────────────────────────────────────────────────
function EditorToolbar({
  editor,
  onSave,
  isSaving,
  isSavingToServer,
  lastSaveTime,
  onToggleComments,
  commentsOpen,
  t,
}: {
  editor: any;
  onSave: () => void;
  isSaving: boolean;
  isSavingToServer?: boolean;
  lastSaveTime?: Date | null;
  onToggleComments?: () => void;
  commentsOpen?: boolean;
  t: any;
}) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const linkWrapperRef = useRef<HTMLDivElement>(null);

  const handleLinkToggle = () => {
    setShowLinkInput((v) => !v);
  };

  // Indent / outdent — works on lists and paragraphs
  const handleIndent = () => {
    if (editor.isActive('listItem') || editor.isActive('taskItem')) {
      editor.chain().focus().sinkListItem('listItem').run() ||
        editor.chain().focus().sinkListItem('taskItem').run();
    } else {
      const type = editor.state.doc.resolve(editor.state.selection.from).parent.type.name;
      if (type === 'paragraph' || type === 'heading') {
        const current = editor.getAttributes(type).indent ?? 0;
        if (current < 8)
          editor
            .chain()
            .focus()
            .updateAttributes(type, { indent: current + 1 })
            .run();
      }
    }
  };

  const handleOutdent = () => {
    if (editor.isActive('listItem') || editor.isActive('taskItem')) {
      editor.chain().focus().liftListItem('listItem').run() ||
        editor.chain().focus().liftListItem('taskItem').run();
    } else {
      const type = editor.state.doc.resolve(editor.state.selection.from).parent.type.name;
      if (type === 'paragraph' || type === 'heading') {
        const current = editor.getAttributes(type).indent ?? 0;
        if (current > 0)
          editor
            .chain()
            .focus()
            .updateAttributes(type, { indent: current - 1 })
            .run();
      }
    }
  };

  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface, padding: '6px 16px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap', overflowX: 'auto' }}>
        {/* History */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Deshacer (Ctrl+Z)"
        >
          <Undo className="w-4 h-4 sm:w-5 sm:h-5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Rehacer (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Inline formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Negrita (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Cursiva (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Subrayado (Ctrl+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Tachado"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <HighlightPicker editor={editor} />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="Código inline"
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>
        <div ref={linkWrapperRef} style={{ position: 'relative' }}>
          <ToolbarButton
            onClick={handleLinkToggle}
            isActive={editor.isActive('link') || showLinkInput}
            title="Enlace (Ctrl+K)"
          >
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>
          {showLinkInput && (
            <LinkInput
              editor={editor}
              wrapperRef={linkWrapperRef}
              onClose={() => setShowLinkInput(false)}
            />
          )}
        </div>

        <Divider />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Encabezado 1"
        >
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Encabezado 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Encabezado 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Lista de viñetas"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Lista numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          title="Lista de tareas"
        >
          <ListChecks className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Indent / outdent */}
        <ToolbarButton onClick={handleOutdent} title="Disminuir sangría (Shift+Tab)">
          <IndentDecrease className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleIndent} title="Aumentar sangría (Tab)">
          <IndentIncrease className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Blocks */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Cita"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          title="Bloque de código"
        >
          <Code2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Línea horizontal"
        >
          <Minus className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Table with dropdown */}
        <TableMenu editor={editor} t={t} />

        <div style={{ flex: 1 }} />

        {/* Auto-save indicator */}
        {isSavingToServer ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '5px', fontSize: '11.5px',
            background: `${C.amber}12`, border: `1px solid ${C.amber}35`, color: C.amber,
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.amber }} className="animate-pulse" />
            Guardando…
          </div>
        ) : lastSaveTime ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', borderRadius: '5px', fontSize: '11.5px',
            background: `${C.green}12`, border: `1px solid ${C.green}35`, color: C.green,
          }}>
            <Check style={{ width: '11px', height: '11px' }} />
            Guardado {formatTimeAgo(lastSaveTime)}
          </div>
        ) : null}

        {/* Toggle comments sidebar */}
        {onToggleComments && (
          <CommentsBtn active={!!commentsOpen} onClick={onToggleComments} />
        )}

        {/* Manual Save (Ctrl+S) */}
        <SaveBtn onClick={onSave} isSaving={!!isSaving} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CollaborativeEditor({
  documentId,
  workspaceId,
  currentUser,
  canEdit,
}: CollaborativeEditorProps) {
  const t = useT();
  const [yjsDoc] = useState(() => new Y.Doc());
  const { saveYjsState } = useDocumentStore();
  const isJoinedRef = useRef(false);
  const [isDocumentReady, setIsDocumentReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const retryCountRef = useRef(0); // Ref en lugar de state para evitar re-renders y re-joins
  const initialSyncReceivedRef = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Bubble-menu inline link input state ───────────────────────────────────
  const [bubbleLinkMode, setBubbleLinkModeState] = useState(false);
  const [bubbleLinkValue, setBubbleLinkValue] = useState('');
  const bubbleLinkModeRef = useRef(false); // ref for shouldShow closure
  const bubbleLinkInputRef = useRef<HTMLInputElement>(null);

  const setBubbleLinkMode = (v: boolean) => {
    bubbleLinkModeRef.current = v;
    setBubbleLinkModeState(v);
  };

  // Snapshot del último estado completo recibido del servidor via document:sync.
  // Usado como fallback de guardado en el desmontaje si el yjsDoc local está vacío
  // (por ejemplo, si la inicialización falló parcialmente o hubo un race condition).
  const lastServerSnapshotRef = useRef<Uint8Array | null>(null);

  // ── Comment sidebar state ─────────────────────────────────────────────────
  const {
    setSidebarOpen,
    setPendingSelection,
    ingestAdded,
    ingestUpdated,
    ingestDeleted,
    ingestResolved,
    clearDocument: clearDocumentComments,
  } = useDocumentCommentStore();
  const commentSidebarOpen = useDocumentCommentStore(selectSidebarOpen);
  const commentsList = useDocumentCommentStore(selectDocumentComments(documentId));
  const activeCommentId = useDocumentCommentStore(selectActiveCommentId);
  const workspaceMembers = useWorkspaceStore((s) =>
    s.currentMembers
      .filter((m) => m.user)
      .map((m) => ({ id: m.user!.id, name: m.user!.name, avatar: m.user!.avatar ?? null }))
  );
  const [selectedText, setSelectedText] = useState('');
  const [isSavingToServer, setIsSavingToServer] = useState(false);
  const [, setTick] = useState(0); // Para re-render periódico del indicador de tiempo

  // Actualizar el indicador de tiempo cada 15 segundos
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  const provider = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const awareness = new Awareness(yjsDoc);
    awareness.setLocalState({ user: { name: currentUser.name, color: currentUser.color } });
    return { awareness };
  }, [yjsDoc]); // Solo recrear si cambia yjsDoc, no el color del usuario

  useEffect(() => {
    // ── Estado de la sesión de sync actual ────────────────────────────────────
    // `isMounted` evita procesar respuestas después del desmontaje.
    // `joinedOnce` distingue la primera conexión de reconexiones posteriores.
    let isMounted = true;
    let joinedOnce = false;
    let syncTimeoutId: ReturnType<typeof setTimeout> | null = null;

    // ── Función principal: join + espera del document:sync ────────────────────
    // Se llama al montar (primera vez) y en cada reconexión del socket.
    const doJoinAndWaitSync = () => {
      if (!isMounted) return;

      // Cancelar timeout anterior si se está reintentando
      if (syncTimeoutId) {
        clearTimeout(syncTimeoutId);
        syncTimeoutId = null;
      }

      // Emitir join al servidor.
      // Si el socket aún no está conectado, socketService lo encola internamente
      // y lo enviará en cuanto el socket establezca conexión.
      socketService.joinDocument(documentId, workspaceId);
      isJoinedRef.current = true;
      joinedOnce = true;

      // Timeout de seguridad: si el document:sync no llega en 8s, pedir
      // el estado de nuevo al servidor (document:request-sync) sin hacer re-join.
      // Esto cubre el caso donde el sync inicial se perdió por un cambio de
      // transporte (polling → websocket). Si tras 5s más sigue sin llegar,
      // abrir el editor de todas formas para no bloquear al usuario.
      syncTimeoutId = setTimeout(() => {
        if (!isMounted || initialSyncReceivedRef.current) return;
        socketService.emit('document:request-sync', { documentId });
        syncTimeoutId = setTimeout(() => {
          if (!isMounted || initialSyncReceivedRef.current) return;
          initialSyncReceivedRef.current = true;
          setIsDocumentReady(true);
          setSyncError(null);
        }, 5000);
      }, 8000);
    };

    // ── Handler del document:sync enviado por el servidor ─────────────────────
    const handleInitialSync = (data: { documentId: string; update: number[] }) => {
      if (!isMounted || data.documentId !== documentId) return;

      if (syncTimeoutId) {
        clearTimeout(syncTimeoutId);
        syncTimeoutId = null;
      }

      try {
        const update = new Uint8Array(data.update);
        Y.applyUpdate(yjsDoc, update, 'server');
        lastServerSnapshotRef.current = update;
        initialSyncReceivedRef.current = true;
        setIsDocumentReady(true);
        setSyncError(null);
      } catch {
        setSyncError('Error al cargar el contenido del documento');
      }
    };

    // ── Handler de reconexión del socket ──────────────────────────────────────
    // socket.io reconecta automáticamente, pero el servidor pierde el room del
    // documento. Este callback rehace el join para volver a recibir el sync.
    // Solo actúa si ya se hizo el join una vez (joinedOnce) para no duplicar
    // el join inicial (que ya hace doJoinAndWaitSync() al final de este efecto).
    const handleSocketReconnect = () => {
      if (!isMounted || !joinedOnce) return;
      // Re-join silencioso: el servidor perdió el room pero no ocultamos el editor
      // para evitar que React desmonte EditorContent mientras ProseMirror sigue vivo.
      initialSyncReceivedRef.current = false;
      doJoinAndWaitSync();
    };

    // Registrar listeners ANTES de hacer join para no perder document:sync
    socketService.onYjsSync(handleInitialSync);
    socketService.onConnect(handleSocketReconnect);

    // Join inicial — ocurre inmediatamente si el socket está conectado,
    // o se encola si el socket aún está en fase de handshake
    doJoinAndWaitSync();

    return () => {
      isMounted = false;
      if (syncTimeoutId) {
        clearTimeout(syncTimeoutId);
        syncTimeoutId = null;
      }
      socketService.off('document:sync', handleInitialSync);
      socketService.offConnect(handleSocketReconnect);
      socketService.leaveDocument(documentId);
      isJoinedRef.current = false;
      initialSyncReceivedRef.current = false;
      retryCountRef.current = 0;
      setIsDocumentReady(false);
      setSyncError(null);
    };
  }, [documentId, workspaceId, yjsDoc]);

  // Memoizar extensions para evitar recreaciones innecesarias
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        history: false,
        codeBlock: false, // replaced by CodeBlockLowlight
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Collaboration.configure({ document: yjsDoc }),
      ...(provider
        ? [
            CollaborationCursor.configure({
              provider,
              user: { name: currentUser.name, color: currentUser.color },
            }),
          ]
        : []),
      Placeholder.configure({
        placeholder: canEdit ? 'Comienza a escribir...' : 'Este documento es de solo lectura',
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: false }),
      ResizableTableRow,
      ResizableTableHeader,
      ResizableTableCell,
      IndentExtension,
      CommentMarkExtension,
    ],
    [yjsDoc, provider, canEdit, currentUser.name, currentUser.color]
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      editable: canEdit,
      editorProps: {
        attributes: { class: 'focus:outline-none' },
        // Override Tab inside lists to sink/lift items
        handleKeyDown(view, event) {
          if (event.key === 'Tab') {
            // Let the IndentExtension keyboard shortcut handle it
            return false;
          }
          return false;
        },
      },
    },
    [] // Solo crear una vez, no recrear en cada render
  );

  useEffect(() => {
    if (!editor) return;
    setIsTransitioning(true);
    const t1 = setTimeout(() => editor.setEditable(canEdit), 150);
    const t2 = setTimeout(() => setIsTransitioning(false), 450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [editor, canEdit]);

  const { saveNow, isSaving, lastSavedAt } = useDocumentAutoSave({
    documentId,
    yjsDoc,
    editor,
    enabled: canEdit && isDocumentReady,
    lastServerSnapshotRef,
    onSave: async (docId, state) => {
      await saveYjsState(docId, state);
    },
  });

  useEffect(() => {
    if (!editor || !yjsDoc || !isDocumentReady) return;

    const updateHandler = (update: Uint8Array, origin: any) => {
      if (origin !== 'server') {
        // Enviar update al servidor (solo sincroniza con otros usuarios)
        socketService.sendYjsUpdate(documentId, update);

        // Indicar que hay cambios pendientes de guardar
        setIsSavingToServer(true);
        // El estado se actualizará cuando recibamos confirmación del servidor
      }
    };
    yjsDoc.on('update', updateHandler);

    const handleUpdate = (data: { documentId: string; update: number[] }) => {
      if (data.documentId === documentId)
        Y.applyUpdate(yjsDoc, new Uint8Array(data.update), 'server');
    };
    socketService.onYjsUpdate(handleUpdate);

    // El guardado principal ahora es via HTTP (useDocumentAutoSave).
    // Este evento del servidor es solo para feedback adicional.
    const handleSaved = (data: { documentId: string; timestamp: number; size: number }) => {
      if (data.documentId === documentId) {
        setIsSavingToServer(false);
      }
    };
    socketService.on('document:saved', handleSaved);

    const handleSaveError = (data: { documentId: string; error: string }) => {
      if (data.documentId === documentId) {
        setIsSavingToServer(false);
      }
    };
    socketService.on('document:save-error', handleSaveError);

    // El servidor perdió el doc de memoria (reinicio del servidor).
    // En lugar de recargar toda la página, hacemos re-join al documento
    // para que el servidor recargue el estado desde DB y nos lo reenvíe.
    const handleReload = (data: { documentId: string }) => {
      if (data.documentId === documentId) {
        initialSyncReceivedRef.current = false;

        // Listener para recibir el nuevo sync
        const handleRejoin = (syncData: { documentId: string; update: number[] }) => {
          if (syncData.documentId !== documentId) return;
          try {
            const update = new Uint8Array(syncData.update);
            Y.applyUpdate(yjsDoc, update, 'server');
            lastServerSnapshotRef.current = update;
            initialSyncReceivedRef.current = true;
          } catch (err) {
            // state re-apply failed after reload — doc remains in last known state
          } finally {
            socketService.off('document:sync', handleRejoin);
          }
        };

        socketService.onYjsSync(handleRejoin);
        socketService.leaveDocument(documentId);
        isJoinedRef.current = false;
        setTimeout(() => {
          socketService.joinDocument(documentId, workspaceId);
          isJoinedRef.current = true;
        }, 500);
      }
    };
    socketService.on('document:reload', handleReload);

    return () => {
      yjsDoc.off('update', updateHandler);
      socketService.off('document:yjs:update', handleUpdate);
      socketService.off('document:saved', handleSaved);
      socketService.off('document:save-error', handleSaveError);
      socketService.off('document:reload', handleReload);
    };
  }, [editor, yjsDoc, documentId, isDocumentReady]);

  // Sincronización manual de Awareness vía Socket.IO
  useEffect(() => {
    if (!provider?.awareness || !isDocumentReady) return;

    const awareness = provider.awareness;

    // Enviar cambios locales de awareness al servidor
    const awarenessChangeHandler = ({ added, updated, removed }: any) => {
      const changedClients = added.concat(updated).concat(removed);
      const awarenessUpdate = Array.from(awarenessEncodeUpdate(awareness, changedClients));

      if (awarenessUpdate.length > 0) {
        socketService.emit('document:awareness:update', {
          documentId,
          update: awarenessUpdate,
        });
      }
    };

    awareness.on('change', awarenessChangeHandler);

    // Recibir cambios remotos de awareness
    const handleRemoteAwareness = (data: { documentId: string; update: number[] }) => {
      if (data.documentId === documentId) {
        awarenessApplyUpdate(awareness, new Uint8Array(data.update), 'server');
      }
    };

    socketService.on('document:awareness:update', handleRemoteAwareness);

    // Enviar estado inicial de awareness
    const fullAwarenessUpdate = Array.from(awarenessEncodeUpdate(awareness, [awareness.clientID]));
    socketService.emit('document:awareness:update', {
      documentId,
      update: fullAwarenessUpdate,
    });

    return () => {
      awareness.off('change', awarenessChangeHandler);
      socketService.off('document:awareness:update', handleRemoteAwareness);
    };
  }, [provider, documentId, isDocumentReady]);

  // ── Force reload handler (cuando se restaura una versión) ────────────────
  useEffect(() => {
    const handleForceReload = (data: { documentId: string; reason: string }) => {
      if (data.documentId === documentId) {
        window.location.reload();
      }
    };

    socketService.onForceReload(handleForceReload);

    return () => {
      socketService.off('document:force-reload', handleForceReload);
    };
  }, [documentId]);

  // ── Socket listeners for realtime comment events ─────────────────────────
  useEffect(() => {
    if (!isDocumentReady) return;

    const handleCommentAdded = (data: { documentId: string; comment: any }) => {
      if (data.documentId === documentId) ingestAdded(documentId, data.comment);
    };
    const handleCommentUpdated = (data: { documentId: string; comment: any }) => {
      if (data.documentId === documentId) ingestUpdated(documentId, data.comment);
    };
    const handleCommentDeleted = (data: { documentId: string; commentId: string }) => {
      if (data.documentId === documentId) ingestDeleted(documentId, data.commentId);
    };
    const handleCommentResolved = (data: { documentId: string; comment: any }) => {
      if (data.documentId === documentId) ingestResolved(documentId, data.comment);
    };

    socketService.on('document:comment:added', handleCommentAdded);
    socketService.on('document:comment:updated', handleCommentUpdated);
    socketService.on('document:comment:deleted', handleCommentDeleted);
    socketService.on('document:comment:resolved', handleCommentResolved);

    return () => {
      socketService.off('document:comment:added', handleCommentAdded);
      socketService.off('document:comment:updated', handleCommentUpdated);
      socketService.off('document:comment:deleted', handleCommentDeleted);
      socketService.off('document:comment:resolved', handleCommentResolved);
    };
  }, [isDocumentReady, documentId, ingestAdded, ingestUpdated, ingestDeleted, ingestResolved]);

  // ── Track selected text for comment preview ───────────────────────────────
  useEffect(() => {
    if (!editor) return undefined;
    const onSelectionUpdate = () => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        setSelectedText(editor.state.doc.textBetween(from, to, ' '));
      } else {
        setSelectedText('');
      }
    };
    editor.on('selectionUpdate', onSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate);
    };
  }, [editor]);

  // ── Sincronizar comment-marks en el editor con el store ──────────────────
  // Cada vez que la lista de comentarios cambia (carga inicial, nuevo comentario,
  // resolve, delete) reconstruimos todas las marcas en el documento Tiptap.
  useEffect(() => {
    if (!editor || !isDocumentReady) return;

    // Usar queueMicrotask para no bloquear renders y dejar que Tiptap procese
    const tid = setTimeout(() => {
      const { state, view } = editor;
      const { tr, doc } = state;
      const commentMarkType = state.schema.marks['commentMark'];
      if (!commentMarkType) return;

      // 1. Quitar TODAS las comment-marks existentes en el doc de una vez
      doc.nodesBetween(0, doc.content.size, (node, pos) => {
        if (!node.isText) return;
        const hasMark = node.marks.some((m) => m.type === commentMarkType);
        if (hasMark) tr.removeMark(pos, pos + node.nodeSize, commentMarkType);
      });

      // 2. Aplicar marcas frescas por cada comentario raíz no resuelto
      commentsList
        .filter((c) => !c.resolved && !c.parentId)
        .forEach((comment) => {
          const { from, to } = comment.position;
          if (from < 0 || to > doc.content.size || from >= to) return;
          const mark = commentMarkType.create({ commentId: comment.id, resolved: false });
          tr.addMark(from, to, mark);
        });

      // Aplicar la transacción sin crear historia (no undo-able)
      tr.setMeta('addToHistory', false);
      view.dispatch(tr);
    }, 0);

    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsList, editor, isDocumentReady]);

  // ── Resaltar el comment-mark activo en el editor ─────────────────────────
  useEffect(() => {
    if (!editorWrapRef.current) return;
    // Quitar clase activa de todos los marks
    editorWrapRef.current.querySelectorAll('.comment-mark.comment-mark--active').forEach((el) => {
      el.classList.remove('comment-mark--active');
    });
    // Añadir clase activa al mark del comentario activo
    if (activeCommentId) {
      editorWrapRef.current
        .querySelectorAll(`[data-comment-id="${activeCommentId}"]`)
        .forEach((el) => el.classList.add('comment-mark--active'));
    }
  }, [activeCommentId]);

  // ── Cleanup comment store on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      clearDocumentComments(documentId);
      setSidebarOpen(false);
      setPendingSelection(null);
    };
  }, [documentId, clearDocumentComments, setSidebarOpen, setPendingSelection]);

  if (!isDocumentReady || !editor) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: C.bg }}>
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          {syncError ? (
            <>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px', margin: '0 auto 16px',
                background: `${C.red}15`, border: `1px solid ${C.red}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg style={{ width: '18px', height: '18px', color: C.red }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>Error al cargar documento</h3>
              <p style={{ fontSize: '13px', color: C.text3, marginBottom: '20px' }}>{syncError}</p>
              <button
                onClick={() => { setSyncError(null); retryCountRef.current = 0; initialSyncReceivedRef.current = false; isJoinedRef.current = false; window.location.reload(); }}
                style={{ padding: '8px 20px', borderRadius: '7px', fontSize: '13px', fontWeight: 500, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                Reintentar
              </button>
            </>
          ) : (
            <>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 16px',
                border: `2px solid ${C.accent}`, borderTopColor: 'transparent',
                animation: 'spin 0.7s linear infinite',
              }} />
              <p style={{ fontSize: '14px', fontWeight: 500, color: C.text, marginBottom: '6px' }}>
                {!isDocumentReady ? 'Cargando documento…' : 'Inicializando editor…'}
              </p>
              {retryCountRef.current > 0 && (
                <p style={{ fontSize: '12px', color: C.text4 }}>Reintentando conexión ({retryCountRef.current}/2)…</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '16px' }}>
                {[0, 200, 400].map((delay) => (
                  <div key={delay} className="animate-pulse" style={{ width: '7px', height: '7px', borderRadius: '50%', background: C.accent, animationDelay: `${delay}ms` }} />
                ))}
              </div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      {canEdit && (
        <EditorToolbar
          editor={editor}
          onSave={saveNow}
          isSaving={isSaving}
          isSavingToServer={isSavingToServer}
          lastSaveTime={lastSavedAt}
          onToggleComments={() => setSidebarOpen(!commentSidebarOpen)}
          commentsOpen={commentSidebarOpen}
          t={t}
        />
      )}

      {/* Bubble menu — appears on text selection */}
      {canEdit && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          shouldShow={({ from, to }) => {
            if (bubbleLinkModeRef.current) return true;
            return from !== to;
          }}
        >
          <div
            className="flex items-center gap-0.5 rounded-[8px] p-1"
            style={{
              background: '#2c313a',
              border: '1px solid #3d434d',
              boxShadow: '0 4px 20px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
            }}
          >
          {[
            { cmd: () => editor.chain().focus().toggleBold().run(),      active: editor.isActive('bold'),      icon: <Bold style={{ width: '13px', height: '13px' }} />,          title: 'Negrita' },
            { cmd: () => editor.chain().focus().toggleItalic().run(),    active: editor.isActive('italic'),    icon: <Italic style={{ width: '13px', height: '13px' }} />,        title: 'Cursiva' },
            { cmd: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), icon: <UnderlineIcon style={{ width: '13px', height: '13px' }} />, title: 'Subrayado' },
            { cmd: () => editor.chain().focus().toggleStrike().run(),    active: editor.isActive('strike'),    icon: <Strikethrough style={{ width: '13px', height: '13px' }} />, title: 'Tachado' },
            { cmd: () => editor.chain().focus().toggleCode().run(),      active: editor.isActive('code'),      icon: <Code style={{ width: '13px', height: '13px' }} />,          title: 'Código' },
          ].map(({ cmd, active, icon, title }) => (
            <BubbleBtn key={title} onMouseDown={(e) => { e.preventDefault(); cmd(); }} active={active} title={title}>
              {icon}
            </BubbleBtn>
          ))}

          <div style={{ width: '1px', height: '16px', background: C.border2, margin: '0 2px' }} />

          {HIGHLIGHT_COLORS.slice(0, 5).map((hc) => (
            <button
              key={hc.value}
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHighlight({ color: hc.value }).run(); }}
              title={`Resaltar: ${hc.label}`}
              style={{ backgroundColor: hc.value, width: '18px', height: '18px', borderRadius: '4px', border: '2px solid rgba(255,255,255,0.15)', cursor: 'pointer', flexShrink: 0 }}
            />
          ))}
          {editor.isActive('highlight') && (
            <BubbleBtn onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); }} title="Quitar resaltado">
              <Minus style={{ width: '11px', height: '11px' }} />
            </BubbleBtn>
          )}

          <div style={{ width: '1px', height: '16px', background: C.border2, margin: '0 2px' }} />

          {bubbleLinkMode ? (
            /* ── Inline link input inside bubble menu ── */
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 4px' }}>
              <input
                ref={bubbleLinkInputRef}
                type="text"
                value={bubbleLinkValue}
                onChange={(e) => setBubbleLinkValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = bubbleLinkValue.trim();
                    if (trimmed) {
                      const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
                      editor.chain().focus().setLink({ href, target: '_blank' }).run();
                    }
                    setBubbleLinkMode(false);
                    setBubbleLinkValue('');
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setBubbleLinkMode(false);
                    setBubbleLinkValue('');
                    editor.commands.focus();
                  }
                }}
                placeholder="https://..."
                autoFocus
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '12px',
                  color: '#f0f6ff',
                  outline: 'none',
                  width: '190px',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(56,182,255,0.6)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
              />
              <BubbleBtn
                onMouseDown={(e) => {
                  e.preventDefault();
                  const trimmed = bubbleLinkValue.trim();
                  if (trimmed) {
                    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
                    editor.chain().focus().setLink({ href, target: '_blank' }).run();
                  }
                  setBubbleLinkMode(false);
                  setBubbleLinkValue('');
                }}
                title="Aplicar enlace"
              >
                <Check style={{ width: '12px', height: '12px' }} />
              </BubbleBtn>
              <BubbleBtn
                onMouseDown={(e) => {
                  e.preventDefault();
                  setBubbleLinkMode(false);
                  setBubbleLinkValue('');
                  editor.commands.focus();
                }}
                title="Cancelar"
              >
                <X style={{ width: '12px', height: '12px' }} />
              </BubbleBtn>
            </div>
          ) : (
            <BubbleBtn
              onMouseDown={(e) => {
                e.preventDefault();
                if (editor.isActive('link')) {
                  editor.chain().focus().unsetLink().run();
                } else {
                  setBubbleLinkValue(editor.getAttributes('link').href ?? '');
                  setBubbleLinkMode(true);
                  setTimeout(() => bubbleLinkInputRef.current?.focus(), 30);
                }
              }}
              active={editor.isActive('link')}
              title="Enlace"
            >
              <LinkIcon style={{ width: '13px', height: '13px' }} />
            </BubbleBtn>
          )}

          <div style={{ width: '1px', height: '16px', background: C.border2, margin: '0 2px' }} />

          <BubbleBtn
            onMouseDown={(e) => { e.preventDefault(); const { from, to } = editor.state.selection; if (from === to) return; setPendingSelection({ from, to }); setSidebarOpen(true); setTimeout(() => editor.commands.focus(), 0); }}
            title="Comentar selección"
          >
            <MessageSquare style={{ width: '13px', height: '13px' }} />
          </BubbleBtn>
          </div>
        </BubbleMenu>
      )}

      {/* Main content area: editor + sidebar */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Editor scroll area */}
        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ minHeight: '100%', padding: '40px 24px' }}>
            <div
              style={{
                maxWidth: '760px', margin: '0 auto',
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                opacity: isTransitioning ? 0.5 : 1,
                transform: isTransitioning ? 'scale(0.99)' : 'scale(1)',
                transition: 'opacity 0.3s, transform 0.3s',
              }}
            >
              <div ref={editorWrapRef} style={{ padding: '48px 64px', position: 'relative' }}>
                {!canEdit && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    marginBottom: '20px', padding: '8px 14px',
                    background: `${C.amber}12`, borderLeft: `3px solid ${C.amber}`,
                    borderRadius: '0 6px 6px 0', fontSize: '13px', color: C.amber,
                  }}>
                    <Eye style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                    <span>Este documento es de solo lectura</span>
                  </div>
                )}
                <EditorContent
                  editor={editor}
                  className={`
                    prose prose-invert prose-lg max-w-none transition-opacity duration-300
                    ${isTransitioning ? 'opacity-50' : 'opacity-100'}
                    prose-headings:font-bold prose-headings:tracking-tight
                    prose-h1:text-4xl prose-h1:mb-4
                    prose-h2:text-3xl prose-h2:mb-3
                    prose-h3:text-2xl prose-h3:mb-2
                    prose-p:text-base prose-p:leading-relaxed prose-p:mb-4
                    prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:pl-4 prose-blockquote:italic
                    prose-code:bg-surface prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                    prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-border prose-pre:rounded-md prose-pre:text-sm
                    prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-text-primary prose-strong:font-semibold
                    prose-em:text-text-secondary
                    prose-ul:pl-6 prose-ol:pl-6
                    prose-li:my-1
                    [&_ul_ul]:pl-6 [&_ul_ul_ul]:pl-6
                    [&_ol_ol]:pl-6 [&_ol_ol_ol]:pl-6
                    [&_.hljs-keyword]:text-[#c792ea]
                    [&_.hljs-string]:text-[#c3e88d]
                    [&_.hljs-comment]:text-[#546e7a] [&_.hljs-comment]:italic
                    [&_.hljs-number]:text-[#f78c6c]
                    [&_.hljs-function]:text-[#82aaff]
                    [&_.hljs-built_in]:text-[#ffcb6b]
                    [&_.hljs-attr]:text-[#7fdbca]
                    [&_.hljs-variable]:text-[#f07178]
                    [&_.hljs-title]:text-[#82aaff]
                    [&_.hljs-params]:text-[#f07178]
                    [&_.hljs-literal]:text-[#ff5370]
                    [&_.hljs-type]:text-[#ffcb6b]
                    [&_.tableWrapper]:block [&_.tableWrapper]:w-full [&_.tableWrapper]:max-w-full [&_.tableWrapper]:overflow-x-auto
                    [&_table]:border-collapse [&_table]:my-4 [&_table]:w-full [&_table]:max-w-full [&_table]:table-fixed
                    [&_table_th]:bg-surface [&_table_th]:border [&_table_th]:border-border [&_table_th]:px-3 [&_table_th]:py-2 [&_table_th]:text-left [&_table_th]:text-sm [&_table_th]:font-semibold [&_table_th]:break-words [&_table_th]:min-w-0 [&_table_th]:overflow-hidden
                    [&_table_td]:border [&_table_td]:border-border [&_table_td]:px-3 [&_table_td]:py-2 [&_table_td]:text-sm [&_table_td]:align-top [&_table_td]:break-words [&_table_td]:min-w-0 [&_table_td]:overflow-hidden
                    [&_.selectedCell]:bg-accent/10
                    [&_mark]:rounded-sm [&_mark]:px-0.5
                    [&_.comment-mark]:bg-transparent [&_.comment-mark]:border-b-2 [&_.comment-mark]:border-amber-400/30 [&_.comment-mark]:cursor-pointer [&_.comment-mark]:rounded-[2px] [&_.comment-mark]:px-0.5 [&_.comment-mark]:transition-all [&_.comment-mark]:duration-150
                    [&_.comment-mark:hover]:bg-amber-400/20 [&_.comment-mark:hover]:border-amber-400/70
                    [&_.comment-mark--active]:bg-amber-400/25 [&_.comment-mark--active]:border-amber-400 [&_.comment-mark--active]:shadow-[0_1px_0_0_theme(colors.amber.400)]
                    [&_.comment-mark[data-comment-resolved=true]]:bg-transparent [&_.comment-mark[data-comment-resolved=true]]:border-b [&_.comment-mark[data-comment-resolved=true]]:border-dashed [&_.comment-mark[data-comment-resolved=true]]:border-border/30 [&_.comment-mark[data-comment-resolved=true]]:opacity-40
                    focus:outline-none
                  `}
                  onClick={(e) => {
                    // Detectar click en un comment-mark para enfocar el thread
                    const target = (e.target as HTMLElement).closest(
                      '[data-comment-id]'
                    ) as HTMLElement | null;
                    if (target) {
                      const commentId = target.getAttribute('data-comment-id');
                      if (commentId) {
                        setSidebarOpen(true);
                        useDocumentCommentStore.getState().setActiveComment(commentId);
                      }
                    } else {
                      // Click fuera de cualquier comment-mark: deseleccionar el activo
                      useDocumentCommentStore.getState().setActiveComment(null);
                    }
                  }}
                />
                {canEdit && editorWrapRef.current && (
                  <TableHoverButtons
                    editor={editor}
                    containerRef={editorWrapRef}
                    scrollRef={scrollContainerRef}
                  />
                )}
                {editor && editorWrapRef.current && (
                  <TableResizeOverlay
                    editor={editor}
                    containerRef={editorWrapRef}
                    scrollRef={scrollContainerRef}
                    canEdit={canEdit}
                  />
                )}
                {/* Indicadores de comentario en el margen derecho */}
                {editorWrapRef.current && commentsList.length > 0 && (
                  <CommentGutterIndicators
                    comments={commentsList}
                    activeCommentId={activeCommentId}
                    editorEl={editorWrapRef.current}
                    scrollEl={scrollContainerRef.current}
                    onIndicatorClick={(commentId) => {
                      setSidebarOpen(true);
                      useDocumentCommentStore.getState().setActiveComment(commentId);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Backdrop for mobile comment sidebar */}
        {commentSidebarOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 30 }}
            className="md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Comments sidebar */}
        <div
          style={{
            flexShrink: 0, overflow: 'hidden',
            transition: 'width 0.3s ease',
            width: commentSidebarOpen ? '384px' : '0',
            borderLeft: commentSidebarOpen ? `1px solid ${C.border}` : 'none',
          }}
          className={commentSidebarOpen ? 'fixed inset-y-0 right-0 z-40 md:relative md:inset-auto' : ''}
        >
          <DocumentCommentsSidebar
            documentId={documentId}
            canEdit={canEdit}
            selectedText={selectedText}
            members={workspaceMembers}
            onCommentFocus={(commentId, position) => {
              if (editor) {
                editor.commands.setTextSelection(position);
                editor.commands.scrollIntoView();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
