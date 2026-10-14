import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password debe tener mínimo 8 caracteres')
  .max(128, 'Password no puede superar 128 caracteres')
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: 'Password debe incluir al menos una letra y un número',
  });
