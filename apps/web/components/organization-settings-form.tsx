"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  OrganizationSchema,
  OrganizationUpdateRequestSchema,
  type OrganizationResponse
} from "@ma/contracts";
import { Button, Card, CardContent, CardHeader } from "@ma/ui";
import { getApiBaseUrl } from "@/lib/api";

interface OrganizationSettingsFormProps {
  organization: OrganizationResponse;
}

export const OrganizationSettingsForm = ({ organization }: OrganizationSettingsFormProps) => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const parsed = OrganizationUpdateRequestSchema.safeParse({
      name,
      slug: slug.trim() === "" ? null : slug.trim()
    });

    if (!parsed.success) {
      setStatus("error");
      setMessage("Please provide a valid organization name and slug");
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
      const response = await fetch(`${getApiBaseUrl()}/organization`, {
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
        setMessage(body?.error ?? "Unable to update organization");
        return;
      }

      const updated = OrganizationSchema.parse(body);
      setName(updated.name);
      setSlug(updated.slug ?? "");
      setStatus("success");
      setMessage("Organization details updated");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  return (
    <Card data-testid="organization-settings-card">
      <CardHeader>
        <h2 className="text-xl font-semibold" data-testid="organization-settings-heading">
          Organization settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Update the name and slug that identify your workspace across the platform.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="organization-settings-form">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="organization-name">
              Organization name
            </label>
            <input
              id="organization-name"
              type="text"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={name}
              onChange={(event) => setName(event.target.value)}
              data-testid="organization-name-input"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="organization-slug">
              Slug
            </label>
            <input
              id="organization-slug"
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="acme"
              data-testid="organization-slug-input"
            />
            <p className="text-xs text-muted-foreground">
              Slugs should be lowercase, hyphen separated, and unique across all organizations.
            </p>
          </div>
          <Button
            type="submit"
            disabled={status === "loading"}
            data-testid="organization-settings-submit"
          >
            {status === "loading" ? "Saving..." : "Save settings"}
          </Button>
          {message && (
            <p
              className={`text-sm ${
                status === "error" ? "text-destructive" : status === "success" ? "text-emerald-600" : "text-muted-foreground"
              }`}
              data-testid="organization-settings-message"
            >
              {message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
