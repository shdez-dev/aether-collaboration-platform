// apps/web/src/stores/aiPlannerStore.ts

import { create } from 'zustand';
import { apiService } from '@/services/apiService';

// ==================== TYPES ====================

export interface AiCard {
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string | null;
  checklistItems?: string[];
  dependsOn?: string[];
}

export interface AiList {
  name: string;
  cards: AiCard[];
}

export interface AiBoard {
  name: string;
  description: string;
  lists: AiList[];
}

export interface AiMilestone {
  name: string;
  description: string;
  dueDate: string | null;
}

export interface AiProject {
  name: string;
  description: string;
  status: 'PLANNING' | 'ACTIVE';
  milestones: AiMilestone[];
  boards: AiBoard[];
}

export interface AiWorkspace {
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface AiWorkspacePlan {
  workspace: AiWorkspace;
  projects: AiProject[];
}

// ==================== STORE ====================

interface AiPlannerState {
  credits: number;
  plan: AiWorkspacePlan | null;
  step: 1 | 2 | 3;
  isGenerating: boolean;
  isBuilding: boolean;
  error: string | null;

  fetchCredits(): Promise<void>;
  generatePlan(documentText: string): Promise<void>;
  setPlan(plan: AiWorkspacePlan): void;
  buildWorkspace(): Promise<string>;
  reset(): void;
}

export const useAiPlannerStore = create<AiPlannerState>((set, get) => ({
  credits: 0,
  plan: null,
  step: 1,
  isGenerating: false,
  isBuilding: false,
  error: null,

  async fetchCredits() {
    try {
      const res = await apiService.get<{ credits: number }>('/api/ai/credits', true);
      set({ credits: res.data?.credits ?? 3 });
    } catch {
      set({ credits: 3 });
    }
  },

  async generatePlan(documentText: string) {
    set({ isGenerating: true, error: null });
    try {
      const res = await apiService.post<{ plan: AiWorkspacePlan; creditsRemaining: number }>(
        '/api/ai/plan',
        { documentText },
        true
      );
      if (!res.success || !res.data?.plan) {
        throw new Error((res as any).error?.message ?? 'Generation failed');
      }
      set({
        plan: res.data.plan,
        credits: res.data.creditsRemaining,
        step: 2,
        isGenerating: false,
      });
    } catch (err: any) {
      const msg = err.message ?? 'Failed to generate plan';
      set({ isGenerating: false, error: msg });
      throw err;
    }
  },

  setPlan(plan: AiWorkspacePlan) {
    set({ plan });
  },

  async buildWorkspace() {
    const { plan } = get();
    if (!plan) throw new Error('No plan to build');

    set({ isBuilding: true, error: null, step: 3 });
    try {
      const res = await apiService.post<{ workspaceId: string }>('/api/ai/build', { plan }, true);
      if (!res.success || !res.data?.workspaceId) {
        throw new Error((res as any).error?.message ?? 'Build failed');
      }
      set({ isBuilding: false, credits: (get().credits) - 1 });
      return res.data.workspaceId;
    } catch (err: any) {
      set({ isBuilding: false, error: err.message ?? 'Failed to create workspace', step: 2 });
      throw err;
    }
  },

  reset() {
    set({ plan: null, step: 1, isGenerating: false, isBuilding: false, error: null });
  },
}));
