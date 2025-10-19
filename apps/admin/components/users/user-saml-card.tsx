"use client";

import type { SuperAdminSamlAccount } from "@ma/contracts";

interface UserSamlCardProps {
  samlAccounts: SuperAdminSamlAccount[];
}

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

export const UserSamlCard = ({ samlAccounts }: UserSamlCardProps) => {
  if (samlAccounts.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">SAML accounts</h3>
          <p className="text-sm text-muted-foreground">
            No federated identities linked. Connectors will appear here once users authenticate via SAML.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">SAML accounts</h3>
        <p className="text-sm text-muted-foreground">
          Verify linked SAML connections, name IDs, and the most recent sync time for federated sign-ins.
        </p>
      </header>
      <div className="mt-4 space-y-3">
        {samlAccounts.map((account) => (
          <div key={account.id} className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{account.samlConnectionLabel}</p>
                <p className="text-xs text-muted-foreground">{account.email}</p>
              </div>
              <span className="text-xs text-muted-foreground">Linked {formatDate(account.createdAt)}</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              <p>
                Connection ID: <span className="font-mono text-foreground">{account.samlConnectionId}</span>
              </p>
              <p className="mt-1">
                Name ID: <span className="font-mono text-foreground">{account.nameId}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
