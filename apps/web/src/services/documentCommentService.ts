// apps/web/src/services/documentCommentService.ts

export interface DocumentCommentPosition {
  from: number;
  to: number;
}

export interface DocumentCommentUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export interface DocumentCommentData {
  id: string;
  documentId: string;
  content: string;
  position: DocumentCommentPosition;
  resolved: boolean;
  createdBy: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: DocumentCommentUser;
  replies?: DocumentCommentData[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('aether-auth-storage');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

class DocumentCommentService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  }

  private headers(): HeadersInit {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    const token = getAuthToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  private async handle<T>(res: Response): Promise<T> {
    const body: ApiResponse<T> = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message ?? 'Request failed');
    return body.data!;
  }

  /** GET /api/documents/:documentId/comments */
  async list(documentId: string): Promise<DocumentCommentData[]> {
    const res = await fetch(`${this.baseUrl}/api/documents/${documentId}/comments`, {
      headers: this.headers(),
    });
    const data = await this.handle<{ comments: DocumentCommentData[] }>(res);
    return data.comments;
  }

  /** POST /api/documents/:documentId/comments */
  async create(
    documentId: string,
    payload: { content: string; position: DocumentCommentPosition; parentId?: string | null; mentions?: string[] }
  ): Promise<DocumentCommentData> {
    const res = await fetch(`${this.baseUrl}/api/documents/${documentId}/comments`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    const data = await this.handle<{ comment: DocumentCommentData }>(res);
    return data.comment;
  }

  /** PATCH /api/document-comments/:commentId */
  async update(commentId: string, content: string): Promise<DocumentCommentData> {
    const res = await fetch(`${this.baseUrl}/api/document-comments/${commentId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ content }),
    });
    const data = await this.handle<{ comment: DocumentCommentData }>(res);
    return data.comment;
  }

  /** PATCH /api/document-comments/:commentId/resolve */
  async setResolved(commentId: string, resolved: boolean): Promise<DocumentCommentData> {
    const res = await fetch(`${this.baseUrl}/api/document-comments/${commentId}/resolve`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ resolved }),
    });
    const data = await this.handle<{ comment: DocumentCommentData }>(res);
    return data.comment;
  }

  /** DELETE /api/document-comments/:commentId */
  async delete(commentId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/document-comments/${commentId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    await this.handle<{ message: string }>(res);
  }
}

export const documentCommentService = new DocumentCommentService();
