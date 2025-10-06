import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo'),
  email: z
    .string()
    .trim()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
