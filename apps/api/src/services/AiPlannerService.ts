// apps/api/src/services/AiPlannerService.ts
// Servicio de generación de plan de workspace con IA (Groq - gratuito)

import Groq from 'groq-sdk';

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
                  "dueDate": "YYYY-MM-DD or null",
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
- Today is {TODAY}. All dates must be strictly >= today or null. Never generate a past date.
- Generate 1-3 projects (one per major workstream).
- Each project: 2-5 milestones, 2-4 boards.
- Each board: exactly 4 lists named: "Backlog", "In Progress", "Review", "Done".
- ALL cards must be placed exclusively in the FIRST list ("Backlog"). The other lists must have empty cards arrays: "cards": [].
- Each Backlog list: 4-8 cards with concrete, actionable task titles.
- Cards should be real tasks, not generic placeholders.
- For complex cards, add "checklistItems": an array of 2-5 short subtask strings (e.g. ["Write unit tests", "Add error handling", "Update docs"]).
- For cards that logically depend on another card finishing first, add "dependsOn": an array with the EXACT title of 1-2 other cards in the same board's Backlog list. Only reference cards that actually exist in that list.
- Not every card needs checklistItems or dependsOn — only where it makes real project sense.
- Never output text outside the JSON object.`;

class AiPlannerService {
  private client: Groq;

  constructor() {
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY || '',
    });
    console.log('[AiPlannerService] initialized (Groq)');
  }

  async generateWorkspacePlan(documentText: string): Promise<AiWorkspacePlan> {
    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = SYSTEM_PROMPT.replace('{TODAY}', today);

    const completion = await this.client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analyze this document and generate a complete workspace plan:\n\n${documentText}`,
        },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? '';
    return this.parseAndValidate(rawText);
  }

  private parseAndValidate(rawText: string): AiWorkspacePlan {
    let text = rawText.trim();

    // Strip markdown code fences if present
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    let plan: AiWorkspacePlan;
    try {
      plan = JSON.parse(text);
    } catch {
      throw new Error('[AiPlannerService] Failed to parse JSON response from Groq');
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

    return plan;
  }
}

export const aiPlannerService = new AiPlannerService();
