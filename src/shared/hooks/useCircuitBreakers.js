"use client";

import { useState, useEffect, useCallback } from "react";

const POLL_MS = 5000;

function anyBreakerNotClosed(breakers) {
  return breakers.some((b) => b.state && b.state !== "CLOSED");
}

async function loadCircuitBreakers() {
  const res = await fetch("/api/providers/circuit-breakers");
  const data = await res.json();
  return Array.isArray(data.breakers) ? data.breakers : [];
}

/**
 * Fetch and manage per-account circuit breaker statuses.
 * Polls GET every 5s only while any breaker is not CLOSED.
 */
export function useCircuitBreakers() {
  const [breakers, setBreakers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStatuses = useCallback(async () => {
    try {
      const list = await loadCircuitBreakers();
      setBreakers(list);
      return list;
    } catch (error) {
      console.error("Failed to fetch circuit breakers:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCircuitBreakers()
      .then((list) => {
        if (!cancelled) {
          setBreakers(list);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to fetch circuit breakers:", error);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shouldPoll = anyBreakerNotClosed(breakers);

  useEffect(() => {
    if (!shouldPoll) return undefined;
    let cancelled = false;
    const interval = setInterval(() => {
      loadCircuitBreakers()
        .then((list) => {
          if (!cancelled) setBreakers(list);
        })
        .catch((error) => {
          if (!cancelled) console.error("Failed to fetch circuit breakers:", error);
        });
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shouldPoll]);

  const getCircuitBreakerForConnection = useCallback((providerId, connectionId) => {
    return breakers.find((s) => s.name === `${providerId}:${connectionId}`) || null;
  }, [breakers]);

  const getOpenCountForProvider = useCallback((providerId) => {
    const prefix = `${providerId}:`;
    return breakers.filter((s) => s.name.startsWith(prefix) && s.state !== "CLOSED").length;
  }, [breakers]);

  const resetCircuitBreaker = useCallback(async (name) => {
    try {
      await fetch(`/api/providers/circuit-breakers/${encodeURIComponent(name)}/reset`, {
        method: "POST",
      });
      await fetchStatuses();
      return true;
    } catch (error) {
      console.error("Failed to reset circuit breaker:", error);
      return false;
    }
  }, [fetchStatuses]);

  return {
    breakers,
    loading,
    getCircuitBreakerForConnection,
    getOpenCountForProvider,
    resetCircuitBreaker,
    refresh: fetchStatuses,
  };
}
