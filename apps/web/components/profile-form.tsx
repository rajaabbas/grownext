"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  UpdateUserProfileRequestSchema,
  UserProfileSchema,
  type UserProfileResponse
} from "@ma/contracts";
import { Button, Card, CardContent, CardHeader } from "@ma/ui";
import { getApiBaseUrl } from "@/lib/api";

interface ProfileFormProps {
  initialProfile: UserProfileResponse;
}

export const ProfileForm = ({ initialProfile }: ProfileFormProps) => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [fullName, setFullName] = useState(initialProfile.fullName);
  const [email, setEmail] = useState(initialProfile.email);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const parsed = UpdateUserProfileRequestSchema.safeParse({ fullName, email });
    if (!parsed.success) {
      setStatus("error");
      setMessage("Please provide valid profile details");
      return;
    }

    const [{ data: sessionData }, { data: userData }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser()
    ]);

    if (!sessionData.session || !userData.user) {
      setStatus("error");
      setMessage("You are not logged in");
      return;
    }

    const session = sessionData.session;

    try {
      const response = await fetch(`${getApiBaseUrl()}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(parsed.data)
      });

      const body = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(body?.error ?? "Unable to update profile");
        return;
      }

      const updated = UserProfileSchema.parse(body);
      setFullName(updated.fullName);
      setEmail(updated.email);
      setStatus("success");
      setMessage("Profile updated");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  return (
    <Card data-testid="profile-card">
      <CardHeader>
        <h2 className="text-xl font-semibold" data-testid="profile-card-heading">
          Profile
        </h2>
        <p className="text-sm text-muted-foreground">Manage the details associated with your account.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="profile-form">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="profile-email">
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              data-testid="profile-email-input"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="profile-full-name">
              Full name
            </label>
            <input
              id="profile-full-name"
              type="text"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              data-testid="profile-full-name-input"
            />
          </div>
          <Button type="submit" disabled={status === "loading"} data-testid="profile-submit">
            {status === "loading" ? "Saving..." : "Save changes"}
          </Button>
          {message && (
            <p
              className={`text-sm ${
                status === "error" ? "text-destructive" : status === "success" ? "text-emerald-600" : "text-muted-foreground"
              }`}
              data-testid="profile-message"
            >
              {message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
