// apps/web/src/components/WorkspaceIcon.tsx
// Renders a Lucide icon by name stored in workspace.icon / board.icon.
// Falls back to a generic icon for legacy Unicode characters (▣ ◆ etc.)

import {
  Folder,
  FolderOpen,
  Briefcase,
  Rocket,
  Zap,
  Star,
  Globe,
  Code2,
  Layers,
  Layout,
  BarChart2,
  PenTool,
  Megaphone,
  Users,
  Heart,
  Shield,
  Settings,
  BookOpen,
  FlaskConical,
  Camera,
  Music,
  Cpu,
  ShoppingCart,
  Building2,
  Leaf,
  Trophy,
  Target,
  Puzzle,
  type LucideProps,
} from 'lucide-react';
import type { FC } from 'react';

export const WORKSPACE_ICONS: Record<string, FC<LucideProps>> = {
  Folder,
  FolderOpen,
  Briefcase,
  Rocket,
  Zap,
  Star,
  Globe,
  Code2,
  Layers,
  Layout,
  BarChart2,
  PenTool,
  Megaphone,
  Users,
  Heart,
  Shield,
  Settings,
  BookOpen,
  FlaskConical,
  Camera,
  Music,
  Cpu,
  ShoppingCart,
  Building2,
  Leaf,
  Trophy,
  Target,
  Puzzle,
};

export const WORKSPACE_ICON_KEYS = Object.keys(WORKSPACE_ICONS);

// Legacy Unicode characters that were used before
const LEGACY_CHARS = new Set(['▣', '◆', '▦', '▤', '◉', '▲', '●', '■']);

interface WorkspaceIconProps extends LucideProps {
  icon?: string | null;
}

export function WorkspaceIcon({ icon, ...props }: WorkspaceIconProps) {
  if (!icon || LEGACY_CHARS.has(icon)) {
    const Fallback = Folder;
    return <Fallback {...props} />;
  }

  const Icon = WORKSPACE_ICONS[icon];
  if (!Icon) {
    const Fallback = Folder;
    return <Fallback {...props} />;
  }

  return <Icon {...props} />;
}
