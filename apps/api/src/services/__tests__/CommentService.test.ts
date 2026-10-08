// apps/api/src/services/__tests__/CommentService.test.ts

import { CommentService } from '../CommentService';
import { getCommentRepository } from '../../repositories/CommentRepository';
import { eventStore } from '../EventStoreService';
import { notificationService } from '../NotificationService';
import { CardService } from '../CardService';
import { pool } from '../../lib/db';
import { documentService } from '../DocumentService';

jest.mock('../../repositories/CommentRepository');
jest.mock('../EventStoreService');
jest.mock('../NotificationService');
jest.mock('../CardService');
jest.mock('../../lib/db');
jest.mock('../DocumentService');

describe('CommentService', () => {
  let commentService: CommentService;
  let mockCommentRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCommentRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByCardId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      isAuthor: jest.fn(),
      getCardId: jest.fn(),
    };

    (getCommentRepository as jest.Mock).mockReturnValue(mockCommentRepository);
    (pool.query as jest.Mock) = jest.fn().mockResolvedValue({ rows: [] });
    commentService = new CommentService();
  });

  describe('createComment', () => {
    it('should create a comment successfully', async () => {
      const commentData = {
        cardId: 'card-123',
        userId: 'user-123',
        content: 'This is a test comment',
        mentions: ['user-456'],
      };

      const mockComment = {
        id: 'comment-1',
        cardId: commentData.cardId,
        userId: commentData.userId,
        content: commentData.content,
        mentions: commentData.mentions,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCommentWithUser = {
        ...mockComment,
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
          avatar: null,
        },
      };

      mockCommentRepository.create.mockResolvedValue(mockComment);
      mockCommentRepository.findById.mockResolvedValue(mockCommentWithUser);
      jest.spyOn(commentService, 'getMentionCandidates').mockResolvedValue([{ id: 'user-456', name: 'Mentioned User', email: 'mentioned@example.com', avatar: null }]);

      // Mock author query
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [{ id: 'user-123', name: 'Test User', email: 'test@example.com' }],
      });

      // Mock card
      (CardService.getCardById as jest.Mock).mockResolvedValue({
        id: 'card-123',
        title: 'Test Card',
        members: [{ id: 'user-456' }],
      });

      const result = await commentService.createComment(commentData);

      expect(result).toEqual(mockCommentWithUser);
      expect(mockCommentRepository.create).toHaveBeenCalledWith({
        cardId: commentData.cardId,
        userId: commentData.userId,
        content: commentData.content,
        mentions: commentData.mentions,
      });
      expect(eventStore.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'comment.created',
          actor: expect.objectContaining({ id: commentData.userId }),
          subject: expect.objectContaining({ id: mockComment.id }),
          context: expect.objectContaining({ cardId: commentData.cardId }),
        })
      );
    });

    it('should throw error if content is empty', async () => {
      const commentData = {
        cardId: 'card-123',
        userId: 'user-123',
        content: '   ',
      };

      await expect(commentService.createComment(commentData)).rejects.toThrow(
        'Comment content cannot be empty'
      );
    });

    it('should throw error if content exceeds 5000 characters', async () => {
      const commentData = {
        cardId: 'card-123',
        userId: 'user-123',
        content: 'a'.repeat(5001),
      };

      await expect(commentService.createComment(commentData)).rejects.toThrow(
        'Comment content cannot exceed 5000 characters'
      );
    });

    it('rejects mentions outside the card project before inserting the comment', async () => {
      jest.spyOn(commentService, 'getMentionCandidates').mockResolvedValue([]);
      await expect(commentService.createComment({ cardId: 'card-123', userId: 'user-123', content: 'Hola', mentions: ['user-456'] }))
        .rejects.toThrow('Solo puedes mencionar a personas con acceso a este proyecto');
      expect(mockCommentRepository.create).not.toHaveBeenCalled();
    });

    it('valida el documento y guarda una cita generada en el servidor', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'doc-1', title: 'Plan', content: 'Un texto importante' }] });
      (documentService.getEffectiveUserPermission as jest.Mock).mockResolvedValue('VIEW');
      mockCommentRepository.create.mockResolvedValue({ id: 'comment-1' });
      mockCommentRepository.findById.mockResolvedValue({ id: 'comment-1', content: 'Revisar', documentReference: { documentId: 'doc-1', title: 'Plan', quote: 'texto', from: 3, to: 8 } });

      await commentService.createComment({ cardId: 'card-1', userId: 'user-1', content: 'Revisar', documentReference: { documentId: 'doc-1', from: 3, to: 8, quote: 'texto' } });

      expect(mockCommentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        documentReference: { documentId: 'doc-1', title: 'Plan', quote: 'texto', from: 3, to: 8 },
      }));
    });

    it('rechaza referencias a documentos sin acceso antes de crear el comentario', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'doc-1', title: 'Privado', content: 'Secreto' }] });
      (documentService.getEffectiveUserPermission as jest.Mock).mockResolvedValue(null);
      await expect(commentService.createComment({ cardId: 'card-1', userId: 'user-1', content: 'Revisar', documentReference: { documentId: 'doc-1', from: 0, to: 7, quote: 'Secreto' } }))
        .rejects.toThrow('No tienes acceso a este documento del proyecto');
      expect(mockCommentRepository.create).not.toHaveBeenCalled();
    });

    it('no enlaza otro texto si el documento cambió antes de publicar', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'doc-1', title: 'Plan', content: 'Otro texto' }] });
      (documentService.getEffectiveUserPermission as jest.Mock).mockResolvedValue('VIEW');
      await expect(commentService.createComment({ cardId: 'card-1', userId: 'user-1', content: 'Revisar', documentReference: { documentId: 'doc-1', from: 0, to: 4, quote: 'Plan' } }))
        .rejects.toThrow('El documento cambió');
      expect(mockCommentRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getCommentsByCardId', () => {
    it('should return comments for a card', async () => {
      const cardId = 'card-123';
      const mockComments = [
        {
          id: 'comment-1',
          cardId,
          userId: 'user-1',
          content: 'Comment 1',
          user: { id: 'user-1', name: 'User 1' },
        },
        {
          id: 'comment-2',
          cardId,
          userId: 'user-2',
          content: 'Comment 2',
          user: { id: 'user-2', name: 'User 2' },
        },
      ];

      mockCommentRepository.findByCardId.mockResolvedValue(mockComments);

      const result = await commentService.getCommentsByCardId(cardId);

      expect(result).toEqual(mockComments);
      expect(mockCommentRepository.findByCardId).toHaveBeenCalledWith(cardId);
    });

    it('oculta el fragmento si el lector perdió acceso al documento', async () => {
      mockCommentRepository.findByCardId.mockResolvedValue([{ id: 'comment-1', documentReference: { documentId: 'doc-1', title: 'Privado', quote: 'Secreto', from: 0, to: 7 } }]);
      (documentService.getEffectiveUserPermission as jest.Mock).mockResolvedValue(null);
      const comments = await commentService.getCommentsByCardId('card-1', 'reader-1');
      expect(comments[0].documentReference).toBeNull();
    });

    it('avisa si el fragmento ya no está en el documento', async () => {
      mockCommentRepository.findByCardId.mockResolvedValue([{ id: 'comment-1', documentReference: { documentId: 'doc-1', title: 'Plan', quote: 'Texto anterior', from: 0, to: 14 } }]);
      (documentService.getEffectiveUserPermission as jest.Mock).mockResolvedValue('VIEW');
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'doc-1', content: 'Texto nuevo' }] });
      const comments = await commentService.getCommentsByCardId('card-1', 'reader-1');
      expect(comments[0].documentReference?.stale).toBe(true);
    });
  });

  describe('getMentionCandidates', () => {
    it('limita las opciones a personas con acceso al proyecto de la card', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'user-456', name: 'Ana', email: 'ana@example.com', avatar: null }] });
      const candidates = await commentService.getMentionCandidates('card-123', 'user-123');

      expect(candidates).toEqual([{ id: 'user-456', name: 'Ana', email: 'ana@example.com', avatar: null }]);
      expect((pool.query as jest.Mock).mock.calls[0][0]).toContain('project_members pm');
      expect((pool.query as jest.Mock).mock.calls[0][0]).toContain('team_members tm');
      expect((pool.query as jest.Mock).mock.calls[0][1]).toEqual(['card-123', 'user-123']);
    });
  });

  describe('getDocumentCandidates', () => {
    it('solo entrega documentos accesibles del contexto de la card', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'doc-1', title: 'Visible' }, { id: 'doc-2', title: 'Privado' }] });
      (documentService.getEffectiveUserPermission as jest.Mock).mockImplementation((id: string) => Promise.resolve(id === 'doc-1' ? 'VIEW' : null));

      const documents = await commentService.getDocumentCandidates('card-1', 'reader-1');

      expect(documents).toEqual([{ id: 'doc-1', title: 'Visible' }]);
      expect((pool.query as jest.Mock).mock.calls[0][0]).toContain('d.workspace_id = b.workspace_id');
      expect((pool.query as jest.Mock).mock.calls[0][0]).toContain('d.project_id = pb.project_id');
    });
  });

  describe('getCommentById', () => {
    it('should return a comment by id', async () => {
      const commentId = 'comment-123';
      const mockComment = {
        id: commentId,
        cardId: 'card-1',
        userId: 'user-1',
        content: 'Test comment',
        user: { id: 'user-1', name: 'User 1' },
      };

      mockCommentRepository.findById.mockResolvedValue(mockComment);

      const result = await commentService.getCommentById(commentId);

      expect(result).toEqual(mockComment);
      expect(mockCommentRepository.findById).toHaveBeenCalledWith(commentId);
    });

    it('should return null if comment not found', async () => {
      mockCommentRepository.findById.mockResolvedValue(null);

      const result = await commentService.getCommentById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateComment', () => {
    it('should update a comment', async () => {
      const commentId = 'comment-123';
      const userId = 'user-123';
      const updateData = {
        content: 'Updated comment',
        mentions: ['user-456'],
      };

      const mockUpdatedComment = {
        id: commentId,
        cardId: 'card-1',
        userId,
        content: updateData.content,
        mentions: updateData.mentions,
        user: { id: userId, name: 'Test User' },
      };

      mockCommentRepository.isAuthor.mockResolvedValue(true);
      jest.spyOn(commentService, 'getMentionCandidates').mockResolvedValue([{ id: 'user-456', name: 'Mentioned User', email: 'mentioned@example.com', avatar: null }]);
      mockCommentRepository.getCardId.mockResolvedValue('card-1');
      mockCommentRepository.update.mockResolvedValue(mockUpdatedComment);
      mockCommentRepository.findById.mockResolvedValue(mockUpdatedComment);

      const result = await commentService.updateComment(commentId, userId, updateData);

      expect(result).toEqual(mockUpdatedComment);
      expect(mockCommentRepository.isAuthor).toHaveBeenCalledWith(commentId, userId);
      expect(mockCommentRepository.update).toHaveBeenCalledWith(commentId, updateData);
      expect(mockCommentRepository.findById).toHaveBeenCalledWith(commentId);
      expect(eventStore.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'comment.updated',
          actor: expect.objectContaining({ id: userId }),
          subject: expect.objectContaining({ id: commentId }),
        })
      );
    });
  });

  describe('deleteComment', () => {
    it('should delete a comment', async () => {
      const commentId = 'comment-123';
      const userId = 'user-123';
      const cardId = 'card-1';

      mockCommentRepository.isAuthor.mockResolvedValue(true);
      mockCommentRepository.getCardId.mockResolvedValue(cardId);
      mockCommentRepository.delete.mockResolvedValue(true);

      await commentService.deleteComment(commentId, userId);

      expect(mockCommentRepository.isAuthor).toHaveBeenCalledWith(commentId, userId);
      expect(mockCommentRepository.delete).toHaveBeenCalledWith(commentId);
      expect(eventStore.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'comment.deleted',
          actor: expect.objectContaining({ id: userId }),
          subject: expect.objectContaining({ id: commentId }),
          context: expect.objectContaining({ cardId }),
        })
      );
    });
  });
});
