// apps/api/src/middleware/__tests__/auth.test.ts

import { Request, Response, NextFunction } from 'express';
import { authenticateJWT, optionalAuth } from '../auth';
import * as jwt from '../../utils/jwt';
import type { UserId } from '@aether/types';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('authenticateJWT', () => {
    it('should authenticate valid JWT token', () => {
      const mockPayload = {
        userId: 'user-123' as UserId,
        email: 'test@example.com',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid_token',
      };

      jest.spyOn(jwt, 'verifyAccessToken').mockReturnValue(mockPayload);

      authenticateJWT(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should return 401 if no authorization header', () => {
      authenticateJWT(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NO_TOKEN',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header format is invalid', () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token',
      };

      authenticateJWT(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_TOKEN_FORMAT',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid or expired', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid_token',
      };

      jest.spyOn(jwt, 'verifyAccessToken').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authenticateJWT(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing Bearer prefix', () => {
      mockRequest.headers = {
        authorization: 'token_without_bearer',
      };

      authenticateJWT(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should attach user if valid token provided', () => {
      const mockPayload = {
        userId: 'user-123' as UserId,
        email: 'test@example.com',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid_token',
      };

      jest.spyOn(jwt, 'verifyAccessToken').mockReturnValue(mockPayload);

      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should continue without user if no token provided', () => {
      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).user).toBeUndefined();
    });

    it('should continue without user if token is invalid', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid_token',
      };

      jest.spyOn(jwt, 'verifyAccessToken').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).user).toBeUndefined();
    });

    it('should handle malformed authorization header gracefully', () => {
      mockRequest.headers = {
        authorization: 'MalformedHeader',
      };

      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).user).toBeUndefined();
    });
  });
});
