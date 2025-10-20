"use client";

import type { TasksUserStatus } from "@ma/contracts";

interface AccountStateBannerProps {
  status: TasksUserStatus;
}

const statusCopy: Record<TasksUserStatus, { title: string; description: string }> = {
  ACTIVE: {
    title: "",
    description: ""
  },
  INVITED: {
    title: "Invitation pending",
    description:
      "Your access is currently read-only until the invitation is accepted. Contact your admin if this seems unexpected."
  },
  SUSPENDED: {
    title: "Account suspended",
    description:
      "Task updates are disabled while your account is under review. Coordinate with the Super Admin team to restore access."
  },
  DEACTIVATED: {
    title: "Account deactivated",
    description:
      "This account has been deactivated. Task updates and project changes are blocked until it is reactivated."
  }
};

export const AccountStateBanner = ({ status }: AccountStateBannerProps) => {
  const copy = statusCopy[status] ?? statusCopy.ACTIVE;
  if (!copy.title) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-600/60 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
      <div className="flex flex-col gap-1">
        <p className="font-semibold uppercase tracking-wide text-amber-200">{copy.title}</p>
        <p className="text-amber-100/90">{copy.description}</p>
      </div>
    </div>
  );
};
