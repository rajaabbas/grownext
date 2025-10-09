import { z } from "zod";
import { OrganizationRoleSchema } from "./organization";

export const WhoAmIResponseSchema = z.object({
  userId: z.string().min(1).nullable(),
  organizationId: z.string().min(1).nullable(),
  email: z.string().email().nullable(),
  fullName: z.string().min(1).nullable(),
  role: OrganizationRoleSchema.nullable()
});

export type WhoAmIResponse = z.infer<typeof WhoAmIResponseSchema>;
