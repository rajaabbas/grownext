import type { UserProfile } from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { withAuthorizationTransaction } from "./prisma";

export interface UpsertUserProfileInput {
  userId: string;
  email: string;
  fullName: string;
}

export const getUserProfile = async (
  claims: SupabaseJwtClaims | null,
  userId: string
): Promise<UserProfile | null> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.userProfile.findUnique({
      where: { userId }
    })
  );
};

export const upsertUserProfile = async (
  claims: SupabaseJwtClaims | null,
  input: UpsertUserProfileInput
): Promise<UserProfile> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.userProfile.upsert({
      where: { userId: input.userId },
      update: {
        email: input.email,
        fullName: input.fullName
      },
      create: {
        userId: input.userId,
        email: input.email,
        fullName: input.fullName
      }
    })
  );
};

export const findUserProfileByEmail = async (
  claims: SupabaseJwtClaims | null,
  email: string
): Promise<UserProfile | null> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.userProfile.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive"
        }
      }
    })
  );
};
