import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { genAuditId, type AuditAction, type AuditEntry, auditSeverity } from "@/services/audit";

interface AuditContextType {
  entries: AuditEntry[];
  log: (
    action: AuditAction,
    entity: string,
    entityId: string,
    summary: string,
    userId: string,
    userName: string,
    detail?: string
  ) => void;
  clearOldEntries: (daysToKeep?: number) => void;
}

const AuditContext = createContext<AuditContextType | null>(null);
const AUDIT_KEY = "ops_audit_log_v1";
const MAX_ENTRIES = 500;

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const stored = await AsyncStorage.getItem(AUDIT_KEY);
        if (stored) setEntries(JSON.parse(stored));
      } catch {}
    }
    load();
  }, []);

  const log = useCallback((
    action: AuditAction,
    entity: string,
    entityId: string,
    summary: string,
    userId: string,
    userName: string,
    detail?: string,
  ) => {
    const entry: AuditEntry = {
      id: genAuditId(),
      timestamp: new Date().toISOString(),
      userId,
      userName,
      action,
      entity,
      entityId,
      summary,
      severity: auditSeverity(action),
      detail,
    };
    setEntries((prev) => {
      const next = [...prev, entry].slice(-MAX_ENTRIES);
      AsyncStorage.setItem(AUDIT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearOldEntries = useCallback((daysToKeep = 90) => {
    setEntries((prev) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysToKeep);
      const filtered = prev.filter((e) => new Date(e.timestamp) >= cutoff);
      AsyncStorage.setItem(AUDIT_KEY, JSON.stringify(filtered)).catch(() => {});
      return filtered;
    });
  }, []);

  return (
    <AuditContext.Provider value={{ entries, log, clearOldEntries }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) {
    return {
      entries: [],
      log: () => {},
      clearOldEntries: () => {},
    } as AuditContextType;
  }
  return ctx;
}
