"use client";

import { useState } from "react";
import type { BillingContact, BillingTaxId } from "@ma/contracts";
import { formatRateLimitMessage } from "@/lib/rate-limit";

interface BillingContactsEditorProps {
  contacts: BillingContact[];
  taxIds: BillingTaxId[];
}

const contactRoles: BillingContact["role"][] = ["primary", "finance", "technical", "legal"];

const emptyContact = (): BillingContact => ({
  name: "",
  email: "",
  role: "finance",
  phone: null
});

export function BillingContactsEditor({ contacts, taxIds }: BillingContactsEditorProps) {
  const [localContacts, setLocalContacts] = useState<BillingContact[]>(
    contacts.length > 0 ? contacts : [emptyContact()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleContactChange = <K extends keyof BillingContact>(
    index: number,
    key: K,
    value: BillingContact[K]
  ) => {
    setLocalContacts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const handleAddContact = () => {
    setLocalContacts((prev) => [...prev, emptyContact()]);
  };

  const handleRemoveContact = (index: number) => {
    setLocalContacts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      contacts: localContacts.map((contact) => ({
        id: contact.id,
        name: contact.name.trim(),
        email: contact.email.trim(),
        role: contact.role,
        phone: contact.phone ?? null,
        metadata: contact.metadata ?? undefined
      }))
    };

    try {
      const response = await fetch("/api/billing/contacts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest"
        },
        body: JSON.stringify(payload)
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            formatRateLimitMessage("billing contact update", response.headers.get("retry-after"))
          );
        }

        const detail = (json?.message as string | undefined) ?? (json?.error as string | undefined) ?? null;
        throw new Error(detail ?? `Failed to update contacts (${response.status})`);
      }

      setLocalContacts(json?.contacts ?? payload.contacts);
      setSuccess("Billing contacts updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update contacts");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Billing contacts</h3>
          <button
            type="button"
            onClick={handleAddContact}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-fuchsia-500 hover:text-fuchsia-200"
          >
            Add contact
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {localContacts.map((contact, index) => (
            <div key={contact.id ?? index} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
                  Name
                  <input
                    value={contact.name}
                    onChange={(event) => handleContactChange(index, "name", event.target.value)}
                    className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 focus:outline-none"
                    placeholder="Jane Doe"
                  />
                </label>
                <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
                  Email
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(event) => handleContactChange(index, "email", event.target.value)}
                    className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 focus:outline-none"
                    placeholder="billing@example.com"
                  />
                </label>
                <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
                  Role
                  <select
                    value={contact.role}
                    onChange={(event) =>
                      handleContactChange(index, "role", event.target.value as BillingContact["role"])
                    }
                    className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 focus:outline-none"
                  >
                    {contactRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
                  Phone (optional)
                  <input
                    value={contact.phone ?? ""}
                    onChange={(event) => handleContactChange(index, "phone", event.target.value || null)}
                    className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 focus:outline-none"
                    placeholder="+1 555 123 4567"
                  />
                </label>
              </div>
              {localContacts.length > 1 ? (
                <button
                  type="button"
                  onClick={() => handleRemoveContact(index)}
                  className="mt-4 text-xs text-red-300 hover:text-red-200"
                >
                  Remove contact
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Tax identifiers</h3>
        {taxIds.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">
            Tax IDs are provisioned by support at this time. Contact us if you need to update these records.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {taxIds.map((tax) => (
              <li key={tax.id ?? `${tax.type}-${tax.value}`} className="flex flex-col">
                <span className="font-medium text-slate-100">
                  {tax.type}: {tax.value}
                </span>
                <span className="text-slate-400">
                  {tax.country ? `Country: ${tax.country}` : "Country not specified"}{" "}
                  {tax.verified ? "· Verified" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{error}</div> : null}
      {success ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          {success}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-fit rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-400 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save contacts"}
      </button>
    </div>
  );
}
