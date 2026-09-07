"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button, ConfirmModal } from "@/shared/components";

// Custom → native migration panel. Rendered on the providers list page when at
// least one custom OpenAI-compatible node points at a host owned by a native
// provider (exact host match, computed server-side). Migration duplicates the
// connection — the custom node, combos, aliases and priorities stay untouched;
// the key is copied server-side and never returns to the browser. A JSON
// backup of the affected rows is written before the new connection is created.
export default function MigrationPanel() {
  const [suggestions, setSuggestions] = useState(null);
  const [pending, setPending] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [message, setMessage] = useState("");
  const [connectionsVersion, setConnectionsVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/providers/migration-suggestions", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setSuggestions(data?.suggestions || []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [connectionsVersion]);

  const runMigration = async () => {
    if (!pending) return;
    setMigrating(true);
    setMessage("");
    try {
      const res = await fetch("/api/providers/migration-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: pending.connectionId, nativeProvider: pending.nativeProvider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Migration failed.");
      } else {
        setMessage(`Native connection created. Custom connection kept — update combos/aliases to the native prefix manually.`);
        setConnectionsVersion((v) => v + 1);
      }
    } catch {
      setMessage("Migration failed.");
    } finally {
      setMigrating(false);
      setPending(null);
    }
  };

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-text-muted">move_item</span>
        <h2 className="text-lg sm:text-xl font-semibold leading-tight">Native migration available</h2>
      </div>
      <p className="text-sm text-text-muted">
        These custom connections match a built-in provider. Migrating creates a native connection with the same key —
        nothing is deleted or retargeted, and a backup is written first.
      </p>
      <ul className="flex flex-col gap-2">
        {suggestions.map((s) => (
          <li key={s.nodeId} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{s.nodeName} → {s.nativeProvider}</p>
              <p className="truncate text-xs text-text-muted">{s.baseUrl}</p>
              {(s.affectedCombos?.length > 0 || s.affectedAliases?.length > 0 || s.affectedCustomModels?.length > 0) && (
                <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                  References to update manually after migrating
                  {s.affectedCombos?.length > 0 && ` — combos: ${s.affectedCombos.join(", ")}`}
                  {s.affectedAliases?.length > 0 && ` — aliases: ${s.affectedAliases.join(", ")}`}
                  {s.affectedCustomModels?.length > 0 && ` — custom models: ${s.affectedCustomModels.join(", ")}`}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <label className="text-[11px] text-text-muted" htmlFor={`mig-conn-${s.nodeId}`}>
                Connection to duplicate
              </label>
              <MigrationConnectionPicker
                nodeId={s.nodeId}
                nativeProvider={s.nativeProvider}
                onPick={(connectionId) => setPending({ ...s, connectionId })}
              />
            </div>
          </li>
        ))}
      </ul>
      {message && <p className="text-xs text-text-muted" role="status" aria-live="polite">{message}</p>}
      <ConfirmModal
        isOpen={!!pending}
        onClose={() => (migrating ? null : setPending(null))}
        onConfirm={runMigration}
        title="Migrate to native provider?"
        message={pending ? `Create a native "${pending.nativeProvider}" connection duplicating "${pending.nodeName}"? The custom connection, combos, aliases and priorities stay unchanged. A backup is written first.` : ""}
        confirmText="Migrate"
        variant="primary"
        loading={migrating}
      />
    </div>
  );
}

function MigrationConnectionPicker({ nodeId, nativeProvider, onPick }) {
  const [connections, setConnections] = useState([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/providers", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setConnections((data?.connections || []).filter((c) => c.provider === nodeId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  if (connections.length === 0) {
    return <span className="text-xs text-text-muted">No connections on this node.</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        id={`mig-conn-${nodeId}`}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="h-8 rounded-lg border border-black/10 bg-black/[0.02] px-2 text-xs outline-none dark:border-white/10 dark:bg-white/[0.03]"
        aria-label="Connection to migrate"
      >
        <option value="">Select…</option>
        {connections.map((c) => (
          <option key={c.id} value={c.id}>{c.name || c.id}</option>
        ))}
      </select>
      <Button size="sm" disabled={!selected} onClick={() => selected && onPick(selected)}>
        Preview
      </Button>
      <span className="hidden">{nativeProvider}</span>
    </div>
  );
}

MigrationConnectionPicker.propTypes = {
  nodeId: PropTypes.string.isRequired,
  nativeProvider: PropTypes.string.isRequired,
  onPick: PropTypes.func.isRequired,
};
