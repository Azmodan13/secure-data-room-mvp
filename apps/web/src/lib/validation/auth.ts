import { z } from 'zod';

const email = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.');

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required.'),
});

export const signUpSchema = z.object({
  email,
  password: z
    .string()
    .min(8, 'Password must contain at least 8 characters.')
    .max(72, 'Password must not exceed 72 characters.'),
});

export type AuthValues = z.infer<typeof signUpSchema>;
