import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  time: z.string(),
  uptime: z.number()
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
