import { z } from "zod";

export const VersionResponseSchema = z.object({
  version: z.string().min(1)
});

export type VersionResponse = z.infer<typeof VersionResponseSchema>;
