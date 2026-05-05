// apps/api/src/controllers/AiBuilderDocumentController.ts
// Planning documents for the AI Builder — no workspace affiliation.
// Stored separately so they can serve as a dataset for future LLM fine-tuning / RAG.

import { Request, Response } from 'express';
import { pool } from '../lib/db';

const TEMPLATE_EN = `# AI Workspace Builder — Project Plan

> Fill in each section. The more detail you provide, the better the AI can structure your workspace, projects, milestones, boards, and tasks.

---

## 1. Introduction
*Describe the general context of the project. What motivated it? Who is it for? What gap does it address?*



## 2. Problem Description
*What specific problem does this project solve? Why does it matter? What are the consequences of not solving it?*



## 3. Proposed Solution
*What exactly are you building? Describe the main modules or components of the solution.*



## 4. Scope & Restrictions
**In scope (this version):**
-

**Out of scope (future versions):**
-



## 5. Objectives

**General objective:** (one sentence describing the overall goal)

**Specific objectives:** (measurable, concrete deliverables)
1.
2.
3.



## 6. Team & Roles
*List each person, their role, and their main responsibilities. This helps the AI assign boards per area.*

| Name | Role | Responsibilities |
|------|------|-----------------|
|      |      |                 |



## 7. Timeline & Milestones
*The AI aligns task due dates to these milestones. Be specific with dates.*

- **Project start date:**
- **Target launch date:**

**Key milestones:**
1. Milestone name — YYYY-MM-DD
2. Milestone name — YYYY-MM-DD
3. Milestone name — YYYY-MM-DD



## 8. Technology Stack
*This guides which boards the AI creates (Backend, Frontend, DevOps, QA, etc.)*

- **Backend:**
- **Frontend:**
- **Database:**
- **Infrastructure / DevOps:**
- **External APIs / Integrations:**



## 9. Functional Requirements
*List the main features and modules with a brief description. These become concrete tasks (cards).*

1. Feature name: description
2. Feature name: description
3. Feature name: description



## 10. Non-Functional Requirements
*Performance, security, scalability, compliance. These become QA and DevOps cards.*

- Performance:
- Security:
- Scalability:
- Compliance / Legal:



## 11. KPIs & Success Metrics
*How will you measure success? Include metric name, target value, and measurement frequency.*

| KPI | Target | Frequency |
|-----|--------|-----------|
|     |        |           |



## 12. Known Risks
*List risks and mitigation strategies. These may become dependency cards or blocked tasks.*

| Risk | Mitigation |
|------|-----------|
|      |           |
`;

const TEMPLATE_ES = `# Constructor IA — Plan de Proyecto

> Completa cada sección con el mayor detalle posible. Cuanta más información proporciones, mejor podrá la IA estructurar tu workspace, proyectos, hitos, tableros y tareas.

---

## 1. Introducción
*Describe el contexto general del proyecto. ¿Qué lo motivó? ¿Para quién es? ¿Qué vacío aborda?*



## 2. Descripción del Problema
*¿Qué problema concreto resuelve este proyecto? ¿Por qué es importante? ¿Qué consecuencias tiene no resolverlo?*



## 3. Formulación de la Solución
*¿Qué estás construyendo exactamente? Describe los módulos o componentes principales de la solución.*



## 4. Alcance y Restricciones
**Incluido en esta versión:**
-

**Excluido (versiones futuras):**
-



## 5. Objetivos

**Objetivo general:** (una oración que describe la meta global)

**Objetivos específicos:** (entregables concretos y medibles)
1.
2.
3.



## 6. Equipo de Trabajo y Roles
*Lista cada persona, su rol y sus responsabilidades principales. Esto ayuda a la IA a asignar boards por área.*

| Nombre | Rol | Responsabilidades |
|--------|-----|-------------------|
|        |     |                   |



## 7. Cronograma e Hitos
*La IA alinea las fechas de las tareas a estos hitos. Sé específico con las fechas.*

- **Fecha de inicio del proyecto:**
- **Fecha objetivo de lanzamiento:**

**Hitos clave:**
1. Nombre del hito — YYYY-MM-DD
2. Nombre del hito — YYYY-MM-DD
3. Nombre del hito — YYYY-MM-DD



## 8. Stack Tecnológico
*Esto guía qué boards crea la IA (Backend, Frontend, DevOps, QA, etc.)*

- **Backend:**
- **Frontend:**
- **Base de datos:**
- **Infraestructura / DevOps:**
- **APIs externas / Integraciones:**



## 9. Requerimientos Funcionales
*Lista las principales funcionalidades y módulos con una breve descripción. Estos se convierten en tareas concretas (cards).*

1. Nombre del módulo: descripción
2. Nombre del módulo: descripción
3. Nombre del módulo: descripción



## 10. Requerimientos No Funcionales
*Rendimiento, seguridad, escalabilidad, cumplimiento. Estos se convierten en cards de QA y DevOps.*

- Rendimiento:
- Seguridad:
- Escalabilidad:
- Cumplimiento / Legal:



## 11. KPIs e Indicadores de Gestión
*¿Cómo medirás el éxito? Incluye nombre del indicador, meta y frecuencia de medición.*

| Indicador | Meta | Frecuencia |
|-----------|------|------------|
|           |      |            |



## 12. Riesgos Identificados
*Lista los riesgos y las estrategias de mitigación. Pueden convertirse en cards de dependencia o tareas bloqueadas.*

| Riesgo | Mitigación |
|--------|-----------|
|        |           |
`;

class AiBuilderDocumentController {
  /** GET /api/ai/documents — list user's planning documents */
  async list(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    const result = await pool.query(
      `SELECT id, title, used_at, created_at, updated_at
       FROM ai_builder_documents
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 50`,
      [userId]
    );
    return res.json({ success: true, data: { documents: result.rows } });
  }

  /** POST /api/ai/documents — create a planning document */
  async create(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    const { title, content, templateId, lang } = req.body;

    let finalContent = typeof content === 'string' ? content : '';
    let finalTitle = typeof title === 'string' ? title.slice(0, 255) : '';

    if (templateId === 'ai-builder') {
      const isEs = String(lang ?? 'en').startsWith('es');
      finalContent = isEs ? TEMPLATE_ES : TEMPLATE_EN;
      if (!finalTitle) finalTitle = isEs ? 'Plan de Proyecto' : 'Project Plan';
    }

    if (finalContent.length > 100000) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR' } });
    }
    if (!finalTitle) finalTitle = 'Untitled Plan';

    const result = await pool.query(
      `INSERT INTO ai_builder_documents (user_id, title, content)
       VALUES ($1, $2, $3)
       RETURNING id, title, content, created_at, updated_at`,
      [userId, finalTitle, finalContent]
    );
    return res.status(201).json({ success: true, data: { document: result.rows[0] } });
  }

  /** GET /api/ai/documents/:id — get one */
  async getById(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    const result = await pool.query(
      `SELECT id, title, content, used_at, created_at, updated_at
       FROM ai_builder_documents WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    return res.json({ success: true, data: { document: result.rows[0] } });
  }

  /** PUT /api/ai/documents/:id — update title and/or content */
  async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    const { title, content } = req.body;
    if (content !== undefined && (typeof content !== 'string' || content.length > 100000)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR' } });
    }

    const result = await pool.query(
      `UPDATE ai_builder_documents
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4
       RETURNING id, title, content, updated_at`,
      [title ? String(title).slice(0, 255) : null, content ?? null, req.params.id, userId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    return res.json({ success: true, data: { document: result.rows[0] } });
  }

  /** PATCH /api/ai/documents/:id/used — marks the document as used to generate a workspace */
  async markUsed(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    await pool.query(
      `UPDATE ai_builder_documents SET used_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    return res.json({ success: true });
  }

  /** DELETE /api/ai/documents/:id */
  async delete(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    await pool.query(
      `DELETE FROM ai_builder_documents WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    return res.json({ success: true });
  }
}

export const aiBuilderDocumentController = new AiBuilderDocumentController();
