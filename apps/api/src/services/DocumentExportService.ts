// apps/api/src/services/DocumentExportService.ts

import * as Y from 'yjs';
import puppeteer from 'puppeteer';

/**
 * DocumentExportService
 * Servicio mejorado para exportar documentos a diferentes formatos
 * preservando completamente la estructura de TipTap/ProseMirror
 */
export class DocumentExportService {
  /**
   * Extraer el documento JSON de YJS
   * TipTap almacena el documento como JSON en el fragmento XML
   */
  private extractDocumentJson(yjsState: Uint8Array): any {
    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, yjsState);

    // TipTap usa un fragmento XML llamado 'default'
    const fragment = tempDoc.getXmlFragment('default');

    // Convertir el fragmento XML a estructura JSON
    const doc = this.xmlFragmentToJson(fragment);

    tempDoc.destroy();
    return doc;
  }

  /**
   * Convertir fragmento XML de YJS a JSON
   */
  private xmlFragmentToJson(fragment: Y.XmlFragment): any {
    const children: any[] = [];

    fragment.forEach((item) => {
      if (item instanceof Y.XmlElement) {
        children.push(this.xmlElementToJson(item));
      } else if (item instanceof Y.XmlText) {
        const text = item.toString();
        if (text) {
          children.push({
            type: 'text',
            text: text,
            marks: this.getTextMarks(item),
          });
        }
      }
    });

    return {
      type: 'doc',
      content: children,
    };
  }

  /**
   * Convertir elemento XML a JSON
   */
  private xmlElementToJson(element: Y.XmlElement): any {
    const nodeName = element.nodeName;
    const attrs = element.getAttributes();

    const children: any[] = [];
    element.forEach((child) => {
      if (child instanceof Y.XmlElement) {
        children.push(this.xmlElementToJson(child));
      } else if (child instanceof Y.XmlText) {
        const text = child.toString();
        if (text) {
          children.push({
            type: 'text',
            text: text,
            marks: this.getTextMarks(child),
          });
        }
      }
    });

    const node: any = {
      type: nodeName,
    };

    // Agregar atributos si existen
    if (Object.keys(attrs).length > 0) {
      node.attrs = attrs;
    }

    // Agregar contenido si existe
    if (children.length > 0) {
      node.content = children;
    }

    return node;
  }

  /**
   * Obtener marks (formato) de un nodo de texto
   */
  private getTextMarks(textNode: Y.XmlText): any[] {
    const attrs = textNode.getAttributes();
    const marks: any[] = [];

    if (attrs.bold) marks.push({ type: 'bold' });
    if (attrs.italic) marks.push({ type: 'italic' });
    if (attrs.underline) marks.push({ type: 'underline' });
    if (attrs.strike) marks.push({ type: 'strike' });
    if (attrs.code) marks.push({ type: 'code' });
    if (attrs.link) marks.push({ type: 'link', attrs: { href: attrs.link.href } });
    if (attrs.highlight) marks.push({ type: 'highlight', attrs: { color: attrs.highlight.color } });

    return marks;
  }

  /**
   * Convertir documento JSON a HTML
   */
  private jsonToHtml(doc: any): string {
    if (!doc.content) return '';
    return doc.content.map((node: any) => this.nodeToHtml(node)).join('');
  }

  /**
   * Convertir nodo individual a HTML
   */
  private nodeToHtml(node: any, listIndex?: number): string {
    if (node.type === 'text') {
      let html = this.escapeHtml(node.text);

      // Aplicar marks
      if (node.marks && node.marks.length > 0) {
        for (const mark of node.marks) {
          switch (mark.type) {
            case 'bold':
              html = `<strong>${html}</strong>`;
              break;
            case 'italic':
              html = `<em>${html}</em>`;
              break;
            case 'underline':
              html = `<u>${html}</u>`;
              break;
            case 'strike':
              html = `<s>${html}</s>`;
              break;
            case 'code':
              html = `<code>${html}</code>`;
              break;
            case 'link':
              html = `<a href="${this.escapeHtml(mark.attrs.href)}">${html}</a>`;
              break;
            case 'highlight':
              html = `<mark style="background-color: ${mark.attrs.color}">${html}</mark>`;
              break;
          }
        }
      }

      return html;
    }

    const content = node.content
      ? node.content.map((child: any, idx: number) => this.nodeToHtml(child, idx + 1)).join('')
      : '';

    switch (node.type) {
      case 'heading': {
        const level = node.attrs?.level || 1;
        const style = node.attrs?.indent
          ? ` style="padding-left: ${node.attrs.indent * 2}rem"`
          : '';
        return `<h${level}${style}>${content}</h${level}>`;
      }

      case 'paragraph': {
        const style = node.attrs?.indent
          ? ` style="padding-left: ${node.attrs.indent * 2}rem"`
          : '';
        return `<p${style}>${content || '<br>'}</p>`;
      }

      case 'bulletList':
        return `<ul>${content}</ul>`;

      case 'orderedList':
        return `<ol>${content}</ol>`;

      case 'listItem':
        return `<li>${content}</li>`;

      case 'taskList':
        return `<ul class="task-list">${content}</ul>`;

      case 'taskItem': {
        const checked = node.attrs?.checked ? ' checked' : '';
        return `<li class="task-item"><input type="checkbox"${checked} disabled> ${content}</li>`;
      }

      case 'codeBlock': {
        const language = node.attrs?.language || '';
        return `<pre><code class="language-${language}">${content}</code></pre>`;
      }

      case 'blockquote':
        return `<blockquote>${content}</blockquote>`;

      case 'horizontalRule':
        return '<hr>';

      case 'hardBreak':
        return '<br>';

      case 'table':
        return `<table>${content}</table>`;

      case 'tableRow':
        return `<tr>${content}</tr>`;

      case 'tableHeader': {
        const colwidth = node.attrs?.colwidth ? ` style="width: ${node.attrs.colwidth}%"` : '';
        return `<th${colwidth}>${content || '<br>'}</th>`;
      }

      case 'tableCell': {
        const colwidth = node.attrs?.colwidth ? ` style="width: ${node.attrs.colwidth}%"` : '';
        return `<td${colwidth}>${content || '<br>'}</td>`;
      }

      default:
        return content;
    }
  }

  /**
   * Convertir documento JSON a Markdown
   */
  private jsonToMarkdown(doc: any): string {
    if (!doc.content) return '';
    return doc.content
      .map((node: any, idx: number) => this.nodeToMarkdown(node, 0, idx + 1))
      .join('');
  }

  /**
   * Convertir nodo individual a Markdown
   */
  private nodeToMarkdown(node: any, listDepth: number = 0, listIndex?: number): string {
    if (node.type === 'text') {
      let text = node.text;

      // Aplicar marks en orden correcto
      if (node.marks && node.marks.length > 0) {
        for (const mark of node.marks) {
          switch (mark.type) {
            case 'code':
              text = `\`${text}\``;
              break;
            case 'bold':
              text = `**${text}**`;
              break;
            case 'italic':
              text = `*${text}*`;
              break;
            case 'strike':
              text = `~~${text}~~`;
              break;
            case 'link':
              text = `[${text}](${mark.attrs.href})`;
              break;
          }
        }
      }

      return text;
    }

    const content = node.content
      ? node.content
          .map((child: any, idx: number) => this.nodeToMarkdown(child, listDepth, idx + 1))
          .join('')
      : '';

    const indent = '  '.repeat(listDepth);

    switch (node.type) {
      case 'heading': {
        const level = node.attrs?.level || 1;
        const indent = node.attrs?.indent ? '  '.repeat(node.attrs.indent) : '';
        return `${indent}${'#'.repeat(level)} ${content}\n\n`;
      }

      case 'paragraph': {
        const indent = node.attrs?.indent ? '  '.repeat(node.attrs.indent) : '';
        return `${indent}${content}\n\n`;
      }

      case 'bulletList':
        return `${content}\n`;

      case 'orderedList':
        return `${content}\n`;

      case 'listItem':
        return `${indent}- ${content}\n`;

      case 'taskList':
        return `${content}\n`;

      case 'taskItem': {
        const checked = node.attrs?.checked ? '[x]' : '[ ]';
        return `${indent}- ${checked} ${content}\n`;
      }

      case 'codeBlock': {
        const language = node.attrs?.language || '';
        return `\`\`\`${language}\n${content}\n\`\`\`\n\n`;
      }

      case 'blockquote':
        return `> ${content.split('\n').join('\n> ')}\n\n`;

      case 'horizontalRule':
        return '---\n\n';

      case 'hardBreak':
        return '  \n';

      case 'table':
        return this.tableToMarkdown(node);

      default:
        return content;
    }
  }

  /**
   * Convertir tabla a Markdown
   */
  private tableToMarkdown(tableNode: any): string {
    if (!tableNode.content) return '';

    let markdown = '\n';
    let isFirstRow = true;

    for (const row of tableNode.content) {
      if (row.type !== 'tableRow' || !row.content) continue;

      const cells = row.content.map((cell: any) => {
        const content = cell.content
          ? cell.content
              .map((child: any) => this.nodeToMarkdown(child, 0))
              .join('')
              .trim()
          : '';
        return content || ' ';
      });

      markdown += `| ${cells.join(' | ')} |\n`;

      // Agregar separador después de la primera fila
      if (isFirstRow) {
        markdown += `| ${cells.map(() => '---').join(' | ')} |\n`;
        isFirstRow = false;
      }
    }

    return markdown + '\n';
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Exportar a HTML
   */
  async exportToHtml(yjsState: Uint8Array, documentTitle: string): Promise<string> {
    const doc = this.extractDocumentJson(yjsState);
    const content = this.jsonToHtml(doc);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(documentTitle)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      color: #1a1a1a;
      background: #ffffff;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.3;
    }
    h1 { font-size: 2.5em; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.3em; }
    h2 { font-size: 2em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
    h3 { font-size: 1.75em; }
    h4 { font-size: 1.5em; }
    h5 { font-size: 1.25em; }
    h6 { font-size: 1.1em; }
    p { margin-bottom: 1em; }
    code {
      background: #f3f4f6;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'Courier New', Consolas, monospace;
      font-size: 0.9em;
      color: #e83e8c;
    }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1em;
      border-radius: 5px;
      overflow-x: auto;
      margin: 1em 0;
    }
    pre code {
      background: none;
      padding: 0;
      color: inherit;
      font-size: 0.875em;
    }
    blockquote {
      border-left: 4px solid #3b82f6;
      padding-left: 1em;
      margin-left: 0;
      margin-right: 0;
      color: #6b7280;
      font-style: italic;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
      overflow: hidden;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 0.75em;
      text-align: left;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background: #f9fafb;
    }
    ul, ol {
      padding-left: 2em;
      margin: 1em 0;
    }
    ul.task-list {
      list-style: none;
      padding-left: 1.5em;
    }
    li.task-item {
      margin-bottom: 0.5em;
    }
    li.task-item input {
      margin-right: 0.5em;
    }
    a {
      color: #3b82f6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    hr {
      border: none;
      border-top: 2px solid #e5e7eb;
      margin: 2em 0;
    }
    mark {
      padding: 0.1em 0.2em;
      border-radius: 2px;
    }
    strong {
      font-weight: 600;
    }
    u {
      text-decoration: underline;
    }
    s {
      text-decoration: line-through;
    }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(documentTitle)}</h1>
  ${content}
</body>
</html>`;
  }

  /**
   * Exportar a Markdown
   */
  async exportToMarkdown(yjsState: Uint8Array, documentTitle: string): Promise<string> {
    const doc = this.extractDocumentJson(yjsState);
    let markdown = `# ${documentTitle}\n\n`;
    markdown += this.jsonToMarkdown(doc);
    return markdown;
  }

  /**
   * Exportar a PDF
   */
  async exportToPdf(yjsState: Uint8Array, documentTitle: string): Promise<Buffer> {
    let html: string;
    try {
      html = await this.exportToHtml(yjsState, documentTitle);
    } catch (error: any) {
      throw new Error(`Failed to generate HTML for PDF: ${error?.message || 'Unknown error'}`);
    }

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();

      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      const pdf = await page.pdf({
        format: 'A4',
        margin: {
          top: '2cm',
          right: '2cm',
          bottom: '2cm',
          left: '2cm',
        },
        printBackground: true,
        preferCSSPageSize: true,
      });

      return Buffer.from(pdf);
    } catch (error: any) {
      throw new Error(`Failed to generate PDF: ${error?.message || 'Unknown error'}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          // ignore close errors
        }
      }
    }
  }
}

export const documentExportService = new DocumentExportService();
