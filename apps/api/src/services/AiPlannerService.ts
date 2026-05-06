// apps/api/src/services/AiPlannerService.ts
// Servicio de generación de plan de workspace con IA (Groq)

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
          milestoneIndex?: number;
          checklistItems?: string[];
          dependsOn?: string[];
        }>;
      }>;
    }>;
  }>;
}

const SYSTEM_PROMPT = `You are a project planning engine. Your sole output is a single valid JSON object — no markdown, no backticks, no prose, no text outside the JSON.

## STEP 1 — INTERPRET THE DOCUMENT
Before generating JSON, internally extract:
- What is the product or system being built? (name it precisely)
- What are its major technical components? (e.g. REST API, React UI, PostgreSQL schema, CI/CD pipeline, mobile app, ML model)
- What are the main functional areas? (e.g. authentication, payments, notifications, reporting)
- What is the domain? (e.g. e-commerce, healthcare, fintech, logistics, SaaS B2B)

Each board must map to one of those extracted components. Never generate boards named "Backend", "Frontend", "DevOps" unless those exact labels appear in the document — use the actual names of the system's components.

## STEP 2 — DEFINE MILESTONES
Generate 2–4 milestones that represent sequential phases of the project:
- M1: Foundation (infrastructure, setup, data models, base architecture)
- M2: Core features (main functionality, primary user flows)
- M3+: Polish, QA, integrations, deployment (only if needed)
Each milestone: { "name": string, "description": string, "dueDate": null }

## STEP 3 — GENERATE BOARDS
Generate 3–5 boards, one per major technical component identified in Step 1.
Each board has exactly 4 lists: "Backlog", "In Progress", "Review", "Done".
Only "Backlog" contains cards. The other 3 lists always have "cards": [].

## STEP 4 — GENERATE CARDS (apply ALL rules below)

### TASK DEFINITION RULES
- Every card title MUST follow the pattern: [Action Verb] + [Concrete Object]
  Good: "Implement JWT refresh token rotation", "Design PostgreSQL schema for orders"
  Bad: "Backend setup", "Work on authentication", "Improve performance"
- Titles: max 120 chars, must be completable in 1–3 days by one person
- Each Backlog: 4–8 cards
- Every card MUST have "priority": "LOW" | "MEDIUM" | "HIGH"
  - Assign at least 1 HIGH card per board (the most critical blocker)
  - HIGH = blocks other work or is on the critical path
  - MEDIUM = important but not an immediate blocker
  - LOW = nice-to-have or polish

### MILESTONE DISTRIBUTION RULES
Distribute cards across milestones as follows:
- milestoneIndex 1 (Foundation): 25–35% of cards in the board → setup, schemas, base config, auth scaffolding
- milestoneIndex 2 (Core): 40–50% of cards → primary features, main business logic
- milestoneIndex N (Final): remaining cards → integration, testing, deployment, polish
Rules:
- milestoneIndex must be between 1 and the total number of milestones
- Never put all cards in milestoneIndex 1
- HIGH priority foundation cards belong in milestoneIndex 1

### DEPENDENCY RULES
- Use "dependsOn" only when card A cannot start until card B is fully done
- "dependsOn" must contain the EXACT title of 1–2 other cards in the same board's Backlog
- If card A dependsOn card B, then A's milestoneIndex >= B's milestoneIndex
- Never create circular dependencies
- Not every card needs "dependsOn" — only genuine blockers

### CHECKLIST RULES
- Add "checklistItems" only to cards with multiple distinct sub-steps
- 2–5 short action strings per checklist (e.g. ["Create DB migration", "Add index on foreign key", "Write integration test"])
- Simple cards do not need a checklist

### ANTI-GENERIC RULE
Every card title must be specific to the domain and system described in the document.
If the document is about a healthcare appointment system, cards must mention appointments, patients, doctors, schedules — not "Create CRUD endpoints" or "Add API routes".
Replace every generic term with the specific domain term from the document.

### STRICT VALIDATION (check before outputting)
- All card titles within a board must be unique
- milestoneIndex on every card is an integer between 1 and total milestones
- Every milestone index from 1 to N has at least 1 card assigned across all boards
- Each board has at least 1 card with "priority": "HIGH"
- No card in "dependsOn" references a title that doesn't exist in that board's Backlog
- "In Progress", "Review", "Done" lists always have "cards": []

## OUTPUT SCHEMA
{
  "workspace": {
    "name": "string (max 60 chars, reflects the actual product name)",
    "description": "string (1–2 sentences, specific to the domain)",
    "icon": "single emoji matching the domain",
    "color": "hex color (e.g. #3b82f6)"
  },
  "projects": [
    {
      "name": "string (max 60 chars)",
      "description": "string",
      "status": "PLANNING",
      "milestones": [
        { "name": "string", "description": "string", "dueDate": null }
      ],
      "boards": [
        {
          "name": "string (specific component name from the document)",
          "description": "string",
          "lists": [
            {
              "name": "Backlog",
              "cards": [
                {
                  "title": "string",
                  "description": "string (optional, 1 sentence max)",
                  "priority": "LOW | MEDIUM | HIGH",
                  "milestoneIndex": 1,
                  "checklistItems": ["string"],
                  "dependsOn": ["exact title of another card in this board's Backlog"]
                }
              ]
            },
            { "name": "In Progress", "cards": [] },
            { "name": "Review", "cards": [] },
            { "name": "Done", "cards": [] }
          ]
        }
      ]
    }
  ]
}

Generate EXACTLY 1 project. Never output text outside the JSON object.`;

class AiPlannerService {
  private client: Groq;

  constructor() {
    this.client = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
    console.log('[AiPlannerService] initialized (Groq llama-3.1-8b-instant)');
  }

  async generateWorkspacePlan(documentText: string): Promise<AiWorkspacePlan> {
    // llama-3.1-8b-instant: 6 000 000 TPM en el free tier de Groq
    const MAX_DOC_CHARS = 8_000;
    const doc = documentText.length > MAX_DOC_CHARS
      ? documentText.slice(0, MAX_DOC_CHARS) + '\n\n[documento truncado]'
      : documentText;

    const completion = await this.client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 8192,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this document and generate a complete workspace plan:\n\n${doc}` },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? '';
    const finishReason = completion.choices[0]?.finish_reason;

    if (finishReason === 'length') {
      console.warn('[AiPlannerService] Response truncated — retrying with reduced scope');
      return this.generateReduced(doc);
    }

    return this.parseAndValidate(rawText);
  }

  private async generateReduced(doc: string): Promise<AiWorkspacePlan> {
    const reducedPrompt = SYSTEM_PROMPT
      .replace('3–5 boards', '2 boards maximum')
      .replace('4–8 cards', '3–5 cards');

    const completion = await this.client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 6000,
      temperature: 0.3,
      messages: [
        { role: 'system', content: reducedPrompt },
        { role: 'user', content: `Analyze this document and generate a focused workspace plan (1 project, 2 boards max):\n\n${doc}` },
      ],
    });

    return this.parseAndValidate(completion.choices[0]?.message?.content ?? '');
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
      throw new Error('[AiPlannerService] Failed to parse JSON response from AI');
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
