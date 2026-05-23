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

const SYSTEM_PROMPT = `Output ONLY a valid JSON object. No markdown, no prose, no text outside the JSON.

AETHER STRUCTURE: Workspace -> 1 Project -> Boards -> Lists -> Cards
- Lists per board: exactly 4 — "Backlog" (cards here), "In Progress"[], "Review"[], "Done"[]
- Cards only in Backlog: { title, priority, milestoneIndex, description? }

BOARDS: If document has "Componentes / Areas -> BOARDS", each item = one board (use exact names). Otherwise infer. Max 4 boards total. No generic names.

MILESTONES (2-3 only): Use document hitos if provided, else: M1=Foundation, M2=Core, M3=Launch. Every milestone needs >= 1 card.

CARDS (4-6 per Backlog, NO MORE):
- Title: [Action Verb] + [Specific Domain Object]. NEVER generic.
- Only create cards for "Incluido" scope. NEVER for "Excluido".
- milestoneIndex: M1=~30%, M2=~50%, M3=rest. Never all in M1.
- priority: HIGH (>=1 per board, required), MEDIUM, LOW.
- description: OMIT unless essential. Max 8 words if included.
- OMIT checklistItems and dependsOn entirely to save space.
- All titles within a board must be unique.

OUTPUT SCHEMA (follow exactly):
{"workspace":{"name":"string","description":"string","icon":"emoji","color":"hex"},"projects":[{"name":"string","description":"string","status":"PLANNING","milestones":[{"name":"string","description":"string","dueDate":null}],"boards":[{"name":"string","description":"string","lists":[{"name":"Backlog","cards":[{"title":"string","priority":"HIGH|MEDIUM|LOW","milestoneIndex":1}]},{"name":"In Progress","cards":[]},{"name":"Review","cards":[]},{"name":"Done","cards":[]}]}]}]}

Generate EXACTLY 1 project.`;

class AiPlannerService {
  private client: Groq;

  constructor() {
    this.client = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
    console.log('[AiPlannerService] initialized (Groq llama-3.1-8b-instant)');
  }

  async generateWorkspacePlan(documentText: string): Promise<AiWorkspacePlan> {
    const MAX_DOC_CHARS = 3_500;
    const doc = documentText.length > MAX_DOC_CHARS
      ? documentText.slice(0, MAX_DOC_CHARS) + '\n\n[documento truncado]'
      : documentText;

    const completion = await this.client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 4800,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this project document and generate a complete Aether workspace plan:\n\n${doc}` },
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
      .replace('3-5 boards total', '2 boards maximum')
      .replace('4-8 cards total per board', '3-5 cards per board');

    const completion = await this.client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 2500,
      temperature: 0.3,
      messages: [
        { role: 'system', content: reducedPrompt },
        { role: 'user', content: `Analyze this document and generate a focused Aether workspace plan (1 project, 2 boards max):\n\n${doc}` },
      ],
    });

    return this.parseAndValidate(completion.choices[0]?.message?.content ?? '');
  }

  private attemptJsonRepair(text: string): string {
    let out = text.trim();

    // If truncated mid-string: cut back to the last safely closed value
    // Find last position of a cleanly closed string followed by : or , or } or ]
    const safeEnd = Math.max(
      out.lastIndexOf('"}'),
      out.lastIndexOf('"]'),
      out.lastIndexOf('",'),
      out.lastIndexOf('",\n'),
    );
    if (safeEnd > out.length * 0.5) {
      // Only truncate if we found a safe point past the halfway mark
      const cutAt = out.lastIndexOf('"', safeEnd) === safeEnd ? safeEnd + 1 : safeEnd + 2;
      out = out.slice(0, cutAt);
    }

    // Remove trailing comma
    out = out.replace(/,\s*$/, '');

    // Close any open arrays and objects
    const opens  = (out.match(/\[/g) || []).length - (out.match(/\]/g) || []).length;
    const braces = (out.match(/\{/g) || []).length - (out.match(/\}/g) || []).length;
    for (let i = 0; i < opens;  i++) out += ']';
    for (let i = 0; i < braces; i++) out += '}';

    return out;
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
      // JSON may be truncated — try to close open brackets and parse
      try {
        const fixed = this.attemptJsonRepair(text);
        plan = JSON.parse(fixed);
        console.warn('[AiPlannerService] JSON was truncated — repaired successfully');
      } catch {
        console.error('[AiPlannerService] Raw response (first 500 chars):', rawText.slice(0, 500));
        throw new Error('[AiPlannerService] Failed to parse JSON response from AI');
      }
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
