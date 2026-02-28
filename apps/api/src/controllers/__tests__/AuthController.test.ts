// apps/api/src/controllers/__tests__/AuthController.test.ts

import { Request, Response } from 'express';
import { AuthController } from '../AuthController';
import { pool } from '../../lib/db';
import { eventStore } from '../../services/EventStoreService';
import { emailService } from '../../services/EmailService';
import * as jwt from '../../utils/jwt';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../../lib/db');
jest.mock('../../services/EventStoreService');
jest.mock('../../services/EmailService');
jest.mock('bcrypt');
jest.mock('crypto');

describe('AuthController', () => {
  let authController: AuthController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    authController = new AuthController();

    // Mock client with query and release methods
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    // Mock pool.connect to return our mock client
    (pool.connect as jest.Mock) = jest.fn().mockResolvedValue(mockClient);

    // Mock response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock request object
    mockRequest = {
      body: {},
      headers: {},
    };
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      mockRequest.body = userData;

      // Mock: user doesn't exist
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      // Mock bcrypt hash
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

      // Mock crypto token generation
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('verification_token'),
      });

      // Mock user creation
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: userData.email,
            name: userData.name,
            avatar: null,
            created_at: new Date(),
          },
        ],
      });

      // Mock event store
      (eventStore.emit as jest.Mock).mockResolvedValue({});

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              email: userData.email,
              name: userData.name,
            }),
          }),
        })
      );

      // Verify password was hashed
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 12);

      // Verify event was emitted
      expect(eventStore.emit).toHaveBeenCalledWith(
        'auth.user.registered',
        expect.objectContaining({
          userId: 'user-123',
          email: userData.email,
        }),
        'user-123'
      );
    });

    it('should return error if email already exists', async () => {
      mockRequest.body = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      };

      // Mock: user already exists
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-user-id' }],
      });

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'EMAIL_ALREADY_EXISTS',
          }),
        })
      );
    });

    it('should return validation error for invalid email', async () => {
      mockRequest.body = {
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User',
      };

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should return validation error for short password', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'short',
        name: 'Test User',
      };

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should release database client even if registration fails', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      mockClient.query.mockRejectedValue(new Error('Database error'));

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockRequest.body = credentials;

      // Mock: user exists
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: credentials.email,
            name: 'Test User',
            password: 'hashed_password',
            avatar: null,
          },
        ],
      });

      // Mock bcrypt compare
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Mock JWT generation
      const generateAccessTokenSpy = jest
        .spyOn(jwt, 'generateAccessToken')
        .mockReturnValue('mock-access-token');
      const generateRefreshTokenSpy = jest
        .spyOn(jwt, 'generateRefreshToken')
        .mockReturnValue('mock-refresh-token');

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            user: expect.objectContaining({
              email: credentials.email,
            }),
          }),
        })
      );

      expect(generateAccessTokenSpy).toHaveBeenCalled();
      expect(generateRefreshTokenSpy).toHaveBeenCalled();

      // Verify event was emitted
      expect(eventStore.emit).toHaveBeenCalledWith(
        'auth.user.loggedIn',
        expect.anything(),
        'user-123'
      );
    });

    it('should return error for non-existent user', async () => {
      mockRequest.body = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      // Mock: user doesn't exist
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_CREDENTIALS',
          }),
        })
      );
    });

    it('should return error for incorrect password', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      // Mock: user exists
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: 'test@example.com',
            password: 'hashed_password',
          },
        ],
      });

      // Mock bcrypt compare - password doesn't match
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_CREDENTIALS',
          }),
        })
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      (mockRequest as any).user = { id: 'user-123' };

      await authController.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );

      expect(eventStore.emit).toHaveBeenCalledWith(
        'auth.user.loggedOut',
        { userId: 'user-123' },
        'user-123'
      );
    });

    it('should handle logout without user (already logged out)', async () => {
      await authController.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(eventStore.emit).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should generate new tokens with valid refresh token', async () => {
      mockRequest.body = {
        refreshToken: 'valid_refresh_token',
      };

      // Mock JWT verification
      jest.spyOn(jwt, 'verifyRefreshToken').mockReturnValue({
        userId: 'user-123' as any,
        email: 'test@example.com',
      });

      // Mock JWT generation
      jest.spyOn(jwt, 'generateAccessToken').mockReturnValue('mock-new-access-token');
      jest.spyOn(jwt, 'generateRefreshToken').mockReturnValue('mock-new-refresh-token');

      // Mock: user exists
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            avatar: null,
          },
        ],
      });

      await authController.refresh(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
          }),
        })
      );
    });

    it('should return error if refresh token is missing', async () => {
      mockRequest.body = {};

      await authController.refresh(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'REFRESH_TOKEN_REQUIRED',
          }),
        })
      );
    });

    it('should return error if refresh token is invalid', async () => {
      mockRequest.body = {
        refreshToken: 'invalid_token',
      };

      jest.spyOn(jwt, 'verifyRefreshToken').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authController.refresh(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_REFRESH_TOKEN',
          }),
        })
      );
    });
  });

  describe('me', () => {
    it('should return current user information', async () => {
      (mockRequest as any).user = { id: 'user-123' };

      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            avatar: null,
            bio: 'Test bio',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await authController.me(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: 'user-123',
              email: 'test@example.com',
            }),
          }),
        })
      );
    });

    it('should return error if user is not authenticated', async () => {
      await authController.me(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
          }),
        })
      );
    });
  });

  describe('verifyEmail', () => {
    it('should successfully verify email with valid token', async () => {
      mockRequest.body = {
        token: 'valid_verification_token',
      };

      const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now

      mockClient.query
        // Find user with token
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'user-123',
              email: 'test@example.com',
              name: 'Test User',
              email_verification_token: 'valid_verification_token',
              email_verification_expires: futureDate,
            },
          ],
        })
        // Update user
        .mockResolvedValueOnce({ rows: [] });

      await authController.verifyEmail(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );

      expect(eventStore.emit).toHaveBeenCalledWith(
        'auth.email.verified',
        expect.anything(),
        'user-123'
      );
    });

    it('should return error for invalid token', async () => {
      mockRequest.body = {
        token: 'invalid_token',
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await authController.verifyEmail(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
          }),
        })
      );
    });

    it('should return error for expired token', async () => {
      mockRequest.body = {
        token: 'expired_token',
      };

      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago

      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: 'test@example.com',
            email_verification_token: 'expired_token',
            email_verification_expires: pastDate,
          },
        ],
      });

      await authController.verifyEmail(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'TOKEN_EXPIRED',
          }),
        })
      );
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email for existing user', async () => {
      mockRequest.body = {
        email: 'test@example.com',
      };

      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('reset_token'),
      });

      mockClient.query
        // Find user
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'user-123',
              email: 'test@example.com',
              name: 'Test User',
            },
          ],
        })
        // Update with reset token
        .mockResolvedValueOnce({ rows: [] });

      await authController.forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          userName: 'Test User',
          resetLink: expect.stringContaining('reset_token'),
        })
      );

      expect(eventStore.emit).toHaveBeenCalledWith(
        'auth.password.resetRequested',
        expect.anything(),
        'user-123'
      );
    });

    it('should return success even for non-existent email (security)', async () => {
      mockRequest.body = {
        email: 'nonexistent@example.com',
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await authController.forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password with valid token', async () => {
      mockRequest.body = {
        token: 'valid_reset_token',
        newPassword: 'newpassword123',
      };

      const futureDate = new Date(Date.now() + 1000 * 60 * 60);

      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');

      mockClient.query
        // Find user with token
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'user-123',
              email: 'test@example.com',
              password_reset_token: 'valid_reset_token',
              password_reset_expires: futureDate,
            },
          ],
        })
        // Update password
        .mockResolvedValueOnce({ rows: [] });

      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);

      expect(eventStore.emit).toHaveBeenCalledWith(
        'auth.password.reset',
        expect.anything(),
        'user-123'
      );
    });

    it('should return error for invalid reset token', async () => {
      mockRequest.body = {
        token: 'invalid_token',
        newPassword: 'newpassword123',
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
          }),
        })
      );
    });

    it('should return error for expired reset token', async () => {
      mockRequest.body = {
        token: 'expired_token',
        newPassword: 'newpassword123',
      };

      const pastDate = new Date(Date.now() - 1000 * 60 * 60);

      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: 'test@example.com',
            password_reset_token: 'expired_token',
            password_reset_expires: pastDate,
          },
        ],
      });

      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'TOKEN_EXPIRED',
          }),
        })
      );
    });
  });
});
