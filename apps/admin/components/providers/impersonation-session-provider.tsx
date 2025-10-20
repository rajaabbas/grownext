"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { useTelemetry } from "./telemetry-provider";

interface ActiveImpersonationSession {
  tokenId: string;
  userId: string;
  userEmail: string;
  userName?: string | null;
  url: string;
  reason?: string | null;
  createdAt: string;
  expiresAt: string;
}

interface ImpersonationSessionContextValue {
  session: ActiveImpersonationSession | null;
  secondsRemaining: number | null;
  isExpiringSoon: boolean;
  stopError: string | null;
  isStopping: boolean;
  startSession: (session: ActiveImpersonationSession) => void;
  stopSession: (source?: "manual" | "auto") => Promise<void>;
  clearSession: () => void;
}

const STORAGE_KEY = "ma.admin.impersonation.session";
const WARNING_THRESHOLD_SECONDS = 60;

const ImpersonationSessionContext = createContext<ImpersonationSessionContextValue | undefined>(
  undefined
);

const computeSecondsRemaining = (expiresAt: string) => {
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) {
    return null;
  }
  const diff = Math.floor((expires - Date.now()) / 1000);
  return diff <= 0 ? 0 : diff;
};

const loadStoredSession = (): ActiveImpersonationSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ActiveImpersonationSession;
    if (!parsed.expiresAt || typeof parsed.tokenId !== "string") {
      return null;
    }

    const secondsRemaining = computeSecondsRemaining(parsed.expiresAt);
    if (secondsRemaining === null || secondsRemaining <= 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const ImpersonationSessionProvider = ({ children }: { children: ReactNode }) => {
  const telemetry = useTelemetry();
  const [session, setSession] = useState<ActiveImpersonationSession | null>(() => loadStoredSession());
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(() =>
    session ? computeSecondsRemaining(session.expiresAt) : null
  );
  const [isExpiringSoon, setIsExpiringSoon] = useState<boolean>(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const sessionRef = useRef<ActiveImpersonationSession | null>(session);
  const stopInFlightRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!session) {
      window.localStorage.removeItem(STORAGE_KEY);
      setSecondsRemaining(null);
      setIsExpiringSoon(false);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    const initialRemaining = computeSecondsRemaining(session.expiresAt);
    setSecondsRemaining(initialRemaining);
    setIsExpiringSoon(Boolean(initialRemaining !== null && initialRemaining <= WARNING_THRESHOLD_SECONDS));
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const remaining = computeSecondsRemaining(session.expiresAt);
      setSecondsRemaining(remaining);
      setIsExpiringSoon(Boolean(remaining !== null && remaining <= WARNING_THRESHOLD_SECONDS));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [session]);

  const clearSession = useCallback(() => {
    setSession(null);
    setStopError(null);
    setIsStopping(false);
    stopInFlightRef.current = false;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const stopSession = useCallback(
    async (source: "manual" | "auto" = "manual") => {
      const currentSession = sessionRef.current;
      if (!currentSession) {
        clearSession();
        return;
      }

      if (stopInFlightRef.current) {
        return;
      }

      stopInFlightRef.current = true;
      setIsStopping(true);
      setStopError(null);

      telemetry.recordEvent("impersonation_session_stop_requested", {
        tokenId: currentSession.tokenId,
        userId: currentSession.userId,
        source
      });

      try {
        const response = await fetch(
          `/api/super-admin/users/${currentSession.userId}/impersonation/${currentSession.tokenId}`,
          {
            method: "DELETE"
          }
        );

        if (!response.ok && response.status !== 404) {
          const payload = await response.json().catch(() => null);
          const message = payload?.error ?? `Failed to stop impersonation session (${response.status})`;
          setStopError(message);
          telemetry.recordEvent("impersonation_session_stop_failed", {
            tokenId: currentSession.tokenId,
            userId: currentSession.userId,
            source,
            error: message
          });
          return;
        }

        telemetry.recordEvent("impersonation_session_stopped", {
          tokenId: currentSession.tokenId,
          userId: currentSession.userId,
          source
        });
      } catch (error) {
        const message = (error as Error).message ?? "Failed to stop impersonation session";
        setStopError(message);
        telemetry.recordEvent("impersonation_session_stop_failed", {
          tokenId: currentSession.tokenId,
          userId: currentSession.userId,
          source,
          error: message
        });
        return;
      } finally {
        stopInFlightRef.current = false;
        setIsStopping(false);
      }

      clearSession();
    },
    [clearSession, telemetry]
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    if (secondsRemaining === null) {
      return;
    }

    if (secondsRemaining > 0) {
      return;
    }

    void stopSession("auto");
  }, [secondsRemaining, session, stopSession]);

  const startSession = useCallback(
    (nextSession: ActiveImpersonationSession) => {
      setSession(nextSession);
      telemetry.recordEvent("impersonation_session_banner_start", {
        tokenId: nextSession.tokenId,
        userId: nextSession.userId,
        expiresAt: nextSession.expiresAt
      });
    },
    [telemetry]
  );

  const value = useMemo<ImpersonationSessionContextValue>(
    () => ({
      session,
      secondsRemaining,
      isExpiringSoon,
      stopError,
      isStopping,
      startSession,
      stopSession,
      clearSession
    }),
    [clearSession, isExpiringSoon, session, secondsRemaining, startSession, stopError, stopSession, isStopping]
  );

  return (
    <ImpersonationSessionContext.Provider value={value}>
      {children}
    </ImpersonationSessionContext.Provider>
  );
};

export const useImpersonationSession = (): ImpersonationSessionContextValue => {
  const context = useContext(ImpersonationSessionContext);
  if (!context) {
    throw new Error("useImpersonationSession must be used within an ImpersonationSessionProvider");
  }
  return context;
};

export type { ActiveImpersonationSession };
