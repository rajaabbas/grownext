"use client";

import { useEffect, useMemo, useState } from "react";
import type { PortalImpersonationState } from "@ma/contracts";

const computeRemainingLabel = (expiresAt: string): string => {
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) {
    return "unknown";
  }
  const diffMs = expires - Date.now();
  if (diffMs <= 0) {
    return "expired";
  }
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes <= 0) {
    return "under a minute";
  }
  if (diffMinutes === 1) {
    return "1 minute";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minutes`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) {
    return "about 1 hour";
  }
  return `${diffHours} hours`;
};

const formatInitiator = (initiatedBy: PortalImpersonationState["initiatedBy"]) => {
  if (!initiatedBy) {
    return "an administrator";
  }
  if (initiatedBy.name && initiatedBy.email) {
    return `${initiatedBy.name} (${initiatedBy.email})`;
  }
  if (initiatedBy.name) {
    return initiatedBy.name;
  }
  if (initiatedBy.email) {
    return initiatedBy.email;
  }
  return "an administrator";
};

export interface ImpersonationBannerProps {
  impersonation: PortalImpersonationState;
}

export const ImpersonationBanner = ({ impersonation }: ImpersonationBannerProps) => {
  const initiator = useMemo(() => formatInitiator(impersonation.initiatedBy), [impersonation.initiatedBy]);
  const [remaining, setRemaining] = useState(() => computeRemainingLabel(impersonation.expiresAt));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemaining(computeRemainingLabel(impersonation.expiresAt));
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [impersonation.expiresAt]);

  return (
    <div
      role="status"
      className="border-b border-amber-600/60 bg-amber-500/10 px-6 py-3 text-sm text-amber-100"
      data-testid="impersonation-banner"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
        <p className="font-medium">
          You are currently being impersonated by {initiator}. Session expires in {remaining}.
        </p>
        {impersonation.reason ? (
          <p className="text-xs text-amber-200/80">
            Reason: {impersonation.reason}
          </p>
        ) : null}
      </div>
    </div>
  );
};
