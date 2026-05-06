// apps/api/src/services/AiPlannerService.ts
// Servicio de generación de plan de workspace con IA (Google Gemini)

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AiWorkspacePlan {
  workspace: {
    name: string;
    description: string;
    icon: string;
    color: string;
  };
  projects: Array<{
    name: string;
    description: string;
    status: 'PLANNING' | 'ACTIVE';
    milestones: Array<{
      name: string;
      description: string;
      dueDate: string | null;
    }>;
    boards: Array<{
      name: string;
      description: string;
      lists: Array<{
        name: string;
        cards: Array<{
          title: string;
          description?: string;
          priority?: 'LOW' | 'MEDIUM' | 'HIGH';
          milestoneIndex?: number;
          dueDate?: string | null;
          checklistItems?: string[];
          dependsOn?: string[];
        }>;
      }>;
    }>;
  }>;
}

const SYSTEM_PROMPT = `You are an expert project manager and software architect for Aether, a team collaboration platform.
Analyze the provided document and generate a complete, professional workspace plan.

You MUST respond with ONLY valid JSON — no markdown, no backticks, no explanation, no text outside the JSON.

Schema:
{
  "workspace": {
    "name": "string (max 60 chars)",
    "description": "string (1-2 sentences)",
    "icon": "single emoji",
    "color": "hex color (e.g. #3b82f6)"
  },
  "projects": [
    {
      "name": "string (max 60 chars)",
      "description": "string",
      "status": "PLANNING",
      "milestones": [
        { "name": "string", "description": "string", "dueDate": "YYYY-MM-DD or null" }
      ],
      "boards": [
        {
          "name": "string (e.g. Backend, Frontend, Design, QA)",
          "description": "string",
          "lists": [
            {
              "name": "string",
              "cards": [
                {
                  "title": "string (max 120 chars)",
                  "description": "string (optional, 1-2 sentences)",
                  "priority": "LOW | MEDIUM | HIGH",
                  "milestoneIndex": 1,
                  "checklistItems": ["string", "string"],
                  "dependsOn": ["exact title of another card in this same board's Backlog"]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Generate EXACTLY 1 project. Do not generate multiple projects.
- The project must have 2-4 milestones and 3-5 boards (one board per major technical area e.g. Backend, Frontend, DevOps, QA, Design).
- Each board: exactly 4 lists named: "Backlog", "In Progress", "Review", "Done".
- ALL cards must be placed exclusively in the FIRST list ("Backlog"). The other lists must have empty cards arrays: "cards": [].
- Each Backlog list: 4-8 cards with concrete, actionable task titles.
- Cards should be real tasks, not generic placeholders.
- For complex cards, add "checklistItems": an array of 2-5 short subtask strings (e.g. ["Write unit tests", "Add error handling", "Update docs"]).
- For cards that logically depend on another card finishing first, add "dependsOn": an array with the EXACT title of 1-2 other cards in the same board's Backlog list. Only reference cards that actually exist in that list.
- Not every card needs checklistItems or dependsOn — only where it makes real project sense.

MILESTONE ASSIGNMENT RULES:
- Each card must have a "milestoneIndex" field: an integer indicating which milestone phase the card belongs to (1 = first milestone, 2 = second, etc.).
- Assign milestoneIndex based on the semantic phase of the work:
    * Foundation tasks (setup, infrastructure, architecture decisions) → milestoneIndex: 1
    * Core feature implementation tasks → milestoneIndex: 2 (or later)
    * Integration, polish, QA, and deployment tasks → last milestone index
- If a card A has "dependsOn" card B, card A's milestoneIndex must be >= card B's milestoneIndex.
- HIGH priority cards that are blockers for others should get the lowest milestoneIndex possible.
- Distribute cards across milestone phases logically — avoid putting all cards in milestoneIndex 1.
- milestoneIndex must be between 1 and the total number of milestones in the project.
- Do NOT include a "dueDate" field on cards — the server will compute dates from milestoneIndex.
- Never output text outside the JSON object.`;

class AiPlannerService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    console.log('[AiPlannerService] initialized (Gemini 2.0 Flash)');
  }

  async generateWorkspacePlan(documentText: string): Promise<AiWorkspacePlan> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
        temperature: 0.3,
      },
    });

    const result = await model.generateContent(
      `Analyze this document and generate a complete workspace plan:\n\n${documentText}`
    );

    const rawText = result.response.text();
    return this.parseAndValidate(rawText);
  }

  private parseAndValidate(rawText: string): AiWorkspacePlan {
    let text = rawText.trim();

    // Strip markdown code fences if present
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    // Try to extract a JSON object if there's surrounding text
    if (!text.startsWith('{')) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) text = match[0];
    }

    let plan: AiWorkspacePlan;
    try {
      plan = JSON.parse(text);
    } catch {
      console.error('[AiPlannerService] Raw response (first 500 chars):', rawText.slice(0, 500));
      throw new Error('[AiPlannerService] Failed to parse JSON response from Gemini');
    }

    // Validate minimum structure
    if (
      !plan.workspace?.name ||
      !Array.isArray(plan.projects) ||
      plan.projects.length === 0 ||
      !plan.projects[0].boards?.length ||
      !plan.projects[0].boards[0].lists?.length
    ) {
      throw new Error('[AiPlannerService] Response missing required structure');
    }

    return this.assignDates(plan);
  }

  private assignDates(plan: AiWorkspacePlan): AiWorkspacePlan {
    const today = new Date().toISOString().split('T')[0];

    for (const project of plan.projects) {
      const milestones = [...project.milestones]
        .filter(m => m.dueDate)
        .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

      if (milestones.length === 0) continue;

      // Build phase ranges: phase i (1-based) → [start, end]
      const ranges: Array<{ start: string; end: string }> = milestones.map((m, i) => ({
        start: i === 0 ? today : this.addDays(milestones[i - 1].dueDate!, 1),
        end: m.dueDate!,
      }));

      const totalPhases = ranges.length;

      for (const board of project.boards) {
        const backlog = board.lists.find(l => l.name === 'Backlog');
        if (!backlog || backlog.cards.length === 0) continue;

        const cards = backlog.cards;

        // Map title → card for dependency lookups
        const cardMap = new Map(cards.map(c => [c.title, c]));

        // Resolve effective milestoneIndex for each card clamped to valid range
        const effectivePhase = new Map<string, number>();
        for (const card of cards) {
          const raw = card.milestoneIndex ?? 1;
          effectivePhase.set(card.title, Math.min(Math.max(raw, 1), totalPhases));
        }

        // Topological sort to propagate dependency constraints
        const visited = new Set<string>();
        const order: string[] = [];
        const visit = (title: string) => {
          if (visited.has(title)) return;
          visited.add(title);
          const card = cardMap.get(title);
          for (const dep of card?.dependsOn ?? []) {
            if (cardMap.has(dep)) visit(dep);
          }
          order.push(title);
        };
        for (const card of cards) visit(card.title);

        // Bump phase forward if a dependency is in a later phase
        for (const title of order) {
          const card = cardMap.get(title);
          for (const dep of card?.dependsOn ?? []) {
            const depPhase = effectivePhase.get(dep) ?? 1;
            const myPhase = effectivePhase.get(title) ?? 1;
            if (depPhase >= myPhase) {
              effectivePhase.set(title, Math.min(depPhase + 1, totalPhases));
            }
          }
        }

        // Group cards by their final phase
        const byPhase = new Map<number, typeof cards>();
        for (const card of cards) {
          const phase = effectivePhase.get(card.title)!;
          if (!byPhase.has(phase)) byPhase.set(phase, []);
          byPhase.get(phase)!.push(card);
        }

        // Assign evenly-spaced dates within each phase range
        for (const [phase, phaseCards] of byPhase) {
          const range = ranges[phase - 1];
          if (!range) continue;

          const startMs = new Date(range.start).getTime();
          const endMs = new Date(range.end).getTime();
          const count = phaseCards.length;
          const step = count > 1 ? (endMs - startMs) / (count - 1) : 0;

          phaseCards.forEach((card, i) => {
            card.dueDate = new Date(startMs + step * i).toISOString().split('T')[0];
          });
        }
      }
    }

    return plan;
  }

  private addDays(date: string, days: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
}

export const aiPlannerService = new AiPlannerService();
