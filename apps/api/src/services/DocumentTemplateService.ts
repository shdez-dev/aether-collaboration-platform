// apps/api/src/services/DocumentTemplateService.ts

import * as Y from 'yjs';

/**
 * DocumentTemplateService
 * Servicio para gestionar plantillas profesionales de documentos
 */

export type TemplateCategory =
  | 'meeting-notes'
  | 'project-brief'
  | 'technical-spec'
  | 'retrospective'
  | 'project-documentation';

export interface DocumentTemplate {
  id: TemplateCategory;
  name: string;
  description: string;
  icon: string;
  category: string;
  getContent: (metadata?: any) => any; // Retorna estructura ProseMirror/TipTap
}

export class DocumentTemplateService {
  /**
   * Obtener todas las plantillas disponibles
   */
  getAvailableTemplates(): Omit<DocumentTemplate, 'getContent'>[] {
    return [
      {
        id: 'meeting-notes',
        name: 'Meeting Notes',
        description: 'Structured template for team meetings with agenda, notes, and action items',
        icon: 'MessageSquare',
        category: 'Collaboration',
      },
      {
        id: 'project-brief',
        name: 'Project Brief',
        description: 'Comprehensive project overview with goals, scope, and timeline',
        icon: 'ClipboardList',
        category: 'Project Management',
      },
      {
        id: 'technical-spec',
        name: 'Technical Specification',
        description: 'Detailed technical documentation for software features',
        icon: 'Settings',
        category: 'Engineering',
      },
      {
        id: 'retrospective',
        name: 'Sprint Retrospective',
        description: 'Agile retrospective template for team reflection',
        icon: 'RotateCcw',
        category: 'Agile',
      },
      {
        id: 'project-documentation',
        name: 'Complete Project Documentation',
        description:
          'Comprehensive project documentation with adaptive sections based on project type',
        icon: 'BookOpen',
        category: 'Documentation',
      },
    ];
  }

  /**
   * Obtener el contenido de una plantilla específica
   */
  getTemplateContent(templateId: TemplateCategory, metadata?: any): any {
    const templates: Record<TemplateCategory, (metadata?: any) => any> = {
      'meeting-notes': this.getMeetingNotesTemplate,
      'project-brief': this.getProjectBriefTemplate,
      'technical-spec': this.getTechnicalSpecTemplate,
      retrospective: this.getRetrospectiveTemplate,
      'project-documentation': this.getProjectDocumentationTemplate,
    };

    const templateFn = templates[templateId];
    if (!templateFn) {
      throw new Error(`Template '${templateId}' not found`);
    }

    return templateFn.call(this, metadata);
  }

  /**
   * Crear un YJS state a partir del contenido de una plantilla
   */
  createYjsStateFromTemplate(templateId: TemplateCategory, metadata?: any): Uint8Array {
    const content = this.getTemplateContent(templateId, metadata);

    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('default');

    // Convertir el contenido JSON a XML fragment de YJS
    this.jsonToXmlFragment(content, fragment);

    const state = Y.encodeStateAsUpdate(doc);
    doc.destroy();

    return state;
  }

  /**
   * Convertir estructura JSON de TipTap a YJS XML Fragment
   */
  private jsonToXmlFragment(json: any, fragment: Y.XmlFragment): void {
    if (!json || !json.content) return;

    json.content.forEach((node: any) => {
      const element = this.jsonNodeToXmlElement(node);
      if (element) {
        fragment.push([element]);
      }
    });
  }

  /**
   * Convertir un nodo JSON a YJS XML Element
   */
  private jsonNodeToXmlElement(node: any): Y.XmlElement | Y.XmlText | null {
    if (node.type === 'text') {
      const text = new Y.XmlText(node.text || '');

      // Aplicar marcas (bold, italic, etc.)
      if (node.marks && node.marks.length > 0) {
        node.marks.forEach((mark: any) => {
          text.format(0, text.length, { [mark.type]: mark.attrs || true });
        });
      }

      return text;
    }

    const element = new Y.XmlElement(node.type);

    // Agregar atributos
    if (node.attrs) {
      Object.entries(node.attrs).forEach(([key, value]) => {
        element.setAttribute(key, value as string);
      });
    }

    // Agregar contenido hijo
    if (node.content && node.content.length > 0) {
      node.content.forEach((child: any) => {
        const childElement = this.jsonNodeToXmlElement(child);
        if (childElement) {
          element.push([childElement]);
        }
      });
    }

    return element;
  }

  // ==================== PLANTILLAS ====================

  /**
   * Plantilla: Meeting Notes
   */
  private getMeetingNotesTemplate(metadata?: any): any {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Meeting Notes' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Date: ' },
            { type: 'text', text: today },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Attendees: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Duration: ' },
            { type: 'text', text: '' },
          ],
        },
        { type: 'horizontalRule' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Agenda' }],
        },
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Topic 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Topic 2' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Topic 3' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Discussion Notes' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Action Items' }],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: '@Owner' },
                    { type: 'text', text: ' - Action item description' },
                  ],
                },
              ],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: '@Owner' },
                    { type: 'text', text: ' - Action item description' },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Key Decisions' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Decision 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Decision 2' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Next Steps' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '' }],
        },
      ],
    };
  }

  /**
   * Plantilla: Project Brief
   */
  private getProjectBriefTemplate(metadata?: any): any {
    return {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Project Brief' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'A comprehensive overview of the project goals, scope, timeline, and stakeholders.',
            },
          ],
        },
        { type: 'horizontalRule' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Project Overview' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Project Name: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Project Owner: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Start Date: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Target Completion: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Objectives & Goals' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'What are we trying to achieve?' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Primary objective' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Secondary objective' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Problem Statement' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'What problem are we solving?' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Proposed Solution' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'How will we solve this problem?' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Scope' }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'In Scope' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Feature/deliverable 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Feature/deliverable 2' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Out of Scope' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'What is not included' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Stakeholders' }],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Name' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Role' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        { type: 'text', marks: [{ type: 'bold' }], text: 'Responsibility' },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Timeline & Milestones' }],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Milestone' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Target Date' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Status' }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Phase 1' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Not Started' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Risks & Mitigation' }],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Risk' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Impact' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        { type: 'text', marks: [{ type: 'bold' }], text: 'Mitigation Strategy' },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'High/Medium/Low' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Budget & Resources' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Estimated budget and resource requirements' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Success Metrics' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'How will we measure success?' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'KPI 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'KPI 2' }],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  /**
   * Plantilla: Technical Specification
   */
  private getTechnicalSpecTemplate(metadata?: any): any {
    return {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Technical Specification' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'Detailed technical documentation for implementing this feature or system.',
            },
          ],
        },
        { type: 'horizontalRule' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Overview' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Feature Name: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Author: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Status: ' },
            { type: 'text', text: 'Draft / In Review / Approved' },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Goals & Non-Goals' }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Goals' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Primary goal' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Non-Goals' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'What we are explicitly not doing' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Architecture & Design' }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'System Architecture' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'High-level architecture overview' }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Data Model' }],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [
            {
              type: 'text',
              text: 'interface Example {\n  id: string;\n  name: string;\n  createdAt: Date;\n}',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'API Endpoints' }],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'http' },
          content: [
            {
              type: 'text',
              text: 'GET /api/resource/:id\nPOST /api/resource\nPUT /api/resource/:id\nDELETE /api/resource/:id',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'User Flow' }],
        },
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'User action 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'System response 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'User action 2' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Security Considerations' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Authentication & Authorization' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Data validation' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Rate limiting' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Performance' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Expected load and scale' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Caching strategy' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Database indexes' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Testing Strategy' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Unit tests' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Integration tests' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'E2E tests' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Deployment & Rollout' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Deployment strategy and rollout plan' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Monitoring & Metrics' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Key metrics to track' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Alerts and dashboards' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Future Considerations' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Potential future enhancements or extensions' }],
        },
      ],
    };
  }

  /**
   * Plantilla: Retrospective
   */
  private getRetrospectiveTemplate(metadata?: any): any {
    return {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Sprint Retrospective' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Sprint: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Date: ' },
            { type: 'text', text: new Date().toLocaleDateString() },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Facilitator: ' },
            { type: 'text', text: '' },
          ],
        },
        { type: 'horizontalRule' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'What Went Well' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'Things that the team did well and should continue',
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'What Could Be Improved' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'Areas where the team faced challenges or could improve',
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Ideas & Experiments' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'New ideas or experiments to try in the next sprint',
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Action Items' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'Concrete actions to take based on this retrospective',
            },
          ],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: '@Owner' },
                    { type: 'text', text: ' - Action description' },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Shout-Outs' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'Recognize team members for their contributions',
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '' }],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  /**
   * Plantilla: Complete Project Documentation
   * Plantilla adaptable según el tipo de proyecto
   */
  private getProjectDocumentationTemplate(metadata?: any): any {
    const projectType = metadata?.projectType || 'software'; // software, construction, research, design, marketing, etc.

    // Contenido base común a todos los tipos
    const baseContent = [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Complete Project Documentation' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            marks: [{ type: 'italic' }],
            text: 'Comprehensive documentation for planning, executing, and delivering this project.',
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '1. Executive Summary' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Project Name: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Project Manager: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Organization: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Start Date: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Expected Completion: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Budget: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Project Summary' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Brief overview of what this project aims to achieve and why it matters.',
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '2. Project Objectives & Goals' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Primary Objectives' }],
      },
      {
        type: 'orderedList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Objective 1' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Objective 2' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Success Criteria' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Metric' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Target' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Status' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '3. Background & Context' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Problem Statement' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'What problem or opportunity is this project addressing?' },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Current Situation' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Describe the current state before this project.' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Desired Outcome' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'What will be different after project completion?' }],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '4. Project Scope' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'In Scope' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Deliverable 1' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Deliverable 2' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Out of Scope' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'What is explicitly not included' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Assumptions' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Key assumptions being made' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Constraints' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Limitations or constraints' }],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
    ];

    // Contenido específico según el tipo de proyecto
    const specificContent = this.getProjectTypeSpecificContent(projectType);

    // Contenido común final
    const finalContent = [
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '6. Team & Stakeholders' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Core Team' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Name' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Role' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Responsibilities' },
                    ],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Contact' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Stakeholders' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Stakeholder' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Interest' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Influence' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'High/Medium/Low' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'High/Medium/Low' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '7. Timeline & Milestones' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Phase' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Milestone' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Start Date' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'End Date' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Status' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Planning' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Requirements Complete' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Not Started' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '8. Budget & Resources' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Budget Breakdown' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Category' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Estimated Cost' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Actual Cost' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Variance' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Personnel' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Tools & Software' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Resource Requirements' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Human resources' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Equipment and tools' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Infrastructure' }],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '9. Risk Management' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Risk' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Probability' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Impact' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Mitigation Strategy' },
                    ],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Owner' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'H/M/L' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'H/M/L' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '10. Communication Plan' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Communication Type' },
                    ],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Frequency' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Audience' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Method' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Status Updates' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Weekly' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Team & Stakeholders' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Email' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '11. Quality Assurance' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Quality Standards' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Quality standard or requirement' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Testing & Validation' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'How will quality be ensured and validated?' }],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '12. Progress Tracking' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Key Performance Indicators (KPIs)' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'KPI' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Target' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Current' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Status' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '13. Lessons Learned' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            marks: [{ type: 'italic' }],
            text: 'Document key learnings throughout the project lifecycle',
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'What Worked Well' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Challenges Faced' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Recommendations for Future Projects' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '' }],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '14. Appendix' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'References & Resources' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Link or reference 1' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Glossary' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Define key terms and acronyms used in this document.' }],
      },
    ];

    return {
      type: 'doc',
      content: [...baseContent, ...specificContent, ...finalContent],
    };
  }

  /**
   * Obtener contenido específico según el tipo de proyecto
   */
  private getProjectTypeSpecificContent(projectType: string): any[] {
    switch (projectType) {
      case 'software':
        return [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '5. Technical Details (Software Project)' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Technology Stack' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Frontend: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Backend: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Database: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Infrastructure: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'System Architecture' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Describe the high-level system architecture.' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Data Model' }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [
              {
                type: 'text',
                text: '// Add your data models here',
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'API Specifications' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Document key API endpoints and their usage.' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Development Environment Setup' }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'bash' },
            content: [
              {
                type: 'text',
                text: '# Installation steps\nnpm install\n# Run development server\nnpm run dev',
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Deployment Process' }],
          },
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Build step' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Test step' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Deploy step' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Security Measures' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Authentication & Authorization' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Data encryption' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Security testing' }],
                  },
                ],
              },
            ],
          },
        ];

      case 'construction':
        return [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '5. Construction Details' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Site Information' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Location: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Site Area: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Zoning: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Architectural Plans' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Reference to architectural drawings and blueprints.' },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Materials & Specifications' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Material' }],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', marks: [{ type: 'bold' }], text: 'Specification' },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Quantity' }],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Supplier' }],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Contractors & Subcontractors' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Company' }],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', marks: [{ type: 'bold' }], text: 'Scope of Work' },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Contact' }],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Permits & Regulations' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Building permits required' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Safety regulations' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Environmental compliance' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Safety Plan' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Safety procedures and protocols for the construction site.' },
            ],
          },
        ];

      case 'research':
        return [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '5. Research Methodology' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Research Questions' }],
          },
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Primary research question' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Secondary research question' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Hypothesis' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'State your research hypothesis.' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Research Design' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Type: ' },
                      { type: 'text', text: 'Qualitative / Quantitative / Mixed Methods' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Approach: ' },
                      { type: 'text', text: 'Experimental / Survey / Case Study / etc.' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Data Collection' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Data sources' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Collection methods' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Sample size and selection' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Data Analysis' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Methods and tools for analyzing collected data.' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Ethical Considerations' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'IRB approval status' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Informed consent procedures' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Data privacy measures' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Literature Review' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Summary of relevant existing research and how this project builds upon it.',
              },
            ],
          },
        ];

      default:
        // Generic project type
        return [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '5. Project Details' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Detailed Description' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Provide detailed information specific to your project type.' },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Deliverables' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Deliverable 1' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Deliverable 2' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Requirements' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Specific requirements for this project.' }],
          },
        ];
    }
  }
}

export const documentTemplateService = new DocumentTemplateService();
