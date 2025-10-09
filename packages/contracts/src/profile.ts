import { z } from "zod";

export const UserProfileSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  fullName: z.string().min(1)
});
export type UserProfileResponse = z.infer<typeof UserProfileSchema>;

export const UpdateUserProfileRequestSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email()
});
export type UpdateUserProfileRequest = z.infer<typeof UpdateUserProfileRequestSchema>;

export const UpdatePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  mfaCode: z
    .string()
    .regex(/^\d{6}$/, "Multi-factor authentication code must be 6 digits")
    .optional()
});
export type UpdatePasswordRequest = z.infer<typeof UpdatePasswordRequestSchema>;

export const UpdatePasswordResponseSchema = z.object({
  status: z.literal("success"),
  message: z.string().min(1)
});
export type UpdatePasswordResponse = z.infer<typeof UpdatePasswordResponseSchema>;
