import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  organisationName: z.string().min(2).max(150),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/** The public "Create account" form of the home page. A request, not an account: no password travels in it. */
export const registrationRequestSchema = z.object({
  organisationName: z.string().min(2, 'Enter your agency name').max(150),
  firstName: z.string().min(1, 'Enter your first name').max(100),
  lastName: z.string().min(1, 'Enter your last name').max(100),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().max(40).optional(),
  message: z.string().max(1000).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegistrationRequestInput = z.infer<typeof registrationRequestSchema>;
