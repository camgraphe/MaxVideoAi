"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  imageTurnInputSchema,
  type ImageConversation,
  type ImageTurnInput,
} from "@/lib/studio/image-conversation-contract";
import {
  acceptsImageConversationResponse,
  imageConfirmationPayload,
  canConfirmImageQuote,
} from "@/lib/studio/image-quote-ui";
import {
  LIVE_PRICING_POLICY_REVISION,
  PRICING_POLICY_HEADER,
} from "@/lib/membership-policy";

class ConversationRequestError extends Error {
  constructor(public code: string | undefined, message: string) {
    super(
      code === "INSUFFICIENT_FUNDS"
        ? "Votre solde est insuffisant pour cette création. Consultez le solde du devis, puis actualisez-le."
        : message,
    );
  }
}

export function useImageConversation(
  projectId: string,
  accountKey: string,
  initialName: string,
) {
  const scope = `${accountKey}:${projectId}`;
  const active = useRef(scope);
  active.current = scope;
  const storageKey = `studio-image-pending:${scope}`;
  const endpoint = `/api/studio/projects/${encodeURIComponent(projectId)}/image-conversation`;
  const [conversation, setConversation] = useState<ImageConversation>({
    projectId,
    projectName: initialName,
    turns: [],
  });
  const [pending, setPending] = useState<ImageTurnInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [insufficientQuote, setInsufficientQuote] = useState<{
    requestId: string;
    quoteId: string;
  } | null>(null);
  const inFlight = useRef(false);
  const readVersion = useRef(0);
  const queuedRead = useRef(false);
  const queuedReaders = useRef<
    {
      resolve: (value: ImageConversation | undefined) => void;
      reject: (error: unknown) => void;
    }[]
  >([]);
  const mounted = useRef(true);
  const load = useCallback(async (): Promise<ImageConversation | undefined> => {
    if (inFlight.current) {
      queuedRead.current = true;
      return new Promise((resolve, reject) =>
        queuedReaders.current.push({ resolve, reject }),
      );
    }
    inFlight.current = true;
    const version = readVersion.current;
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new Error(
          payload.message ?? "Impossible de retrouver la conversation.",
        );
      if (
        version === readVersion.current &&
        mounted.current &&
        acceptsImageConversationResponse(
          scope,
          active.current,
          payload.result.projectId,
          projectId,
        )
      ) {
        setConversation(payload.result);
        const completedPending = payload.result.turns.find(
          (turn: { requestId: string; state: string }) =>
            turn.requestId === pending?.requestId && turn.state === "ready",
        );
        if (completedPending) {
          setPending(null);
          try {
            sessionStorage.removeItem(storageKey);
          } catch {}
        }
        return payload.result as ImageConversation;
      }
    } finally {
      inFlight.current = false;
      if (queuedRead.current) {
        queuedRead.current = false;
        const waiting = queuedReaders.current.splice(0);
        if (mounted.current) {
          void load().then(
            (result) => waiting.forEach((reader) => reader.resolve(result)),
            (failure) => waiting.forEach((reader) => reader.reject(failure)),
          );
        } else waiting.forEach((reader) => reader.resolve(undefined));
      }
    }
  }, [endpoint, scope, projectId, pending?.requestId, storageKey]);
  useEffect(() => {
    mounted.current = true;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) setPending(imageTurnInputSchema.parse(JSON.parse(saved)));
    } catch {}
    return () => {
      mounted.current = false;
    };
  }, [storageKey]);
  useEffect(() => {
    void load().catch(() => {
      if (mounted.current && active.current === scope)
        setReadError("La conversation est momentanément indisponible.");
    });
  }, [load, scope]);
  const needsPolling =
    busy ||
    conversation.turns.some(
      (turn) =>
        turn.state === "thinking" ||
        turn.generation?.status === "running" ||
        turn.generation?.status === "accepted" ||
        (turn.quote &&
          ["claimed", "accepted"].includes(turn.quote.state) &&
          !turn.generation),
    );
  useEffect(() => {
    if (!needsPolling) return;
    const timer = setInterval(() => {
      void load().catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [needsPolling, load]);
  const refresh = useCallback(async () => {
    if (!mounted.current || active.current !== scope) return;
    try {
      const refreshed = await load();
      if (mounted.current && active.current === scope && refreshed) {
        setReadError(null);
        const quote = refreshed.turns.find(
          (turn) => turn.requestId === insufficientQuote?.requestId,
        )?.quote;
        if (
          quote &&
          quote.quoteId === insufficientQuote?.quoteId &&
          canConfirmImageQuote(quote, Date.now(), false)
        ) {
          setError(null);
          setInsufficientQuote(null);
        }
      }
    } catch (failure) {
      if (mounted.current && active.current === scope)
        setReadError(
          failure instanceof Error
            ? failure.message
            : "La conversation est momentanément indisponible.",
        );
    }
  }, [load, scope, insufficientQuote]);
  async function submit(input: ImageTurnInput) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setInsufficientQuote(null);
    setReadError(null);
    setPending(input);
    readVersion.current++;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(input));
    } catch {}
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new ConversationRequestError(
          payload.error,
          payload.message ??
            "Studio ne peut pas encore préparer cette demande.",
        );
      if (mounted.current && active.current === scope) {
        readVersion.current++;
        setConversation((current) => ({
          ...current,
          turns: [
            ...current.turns.filter(
              (turn) => turn.requestId !== payload.result.requestId,
            ),
            payload.result,
          ],
        }));
        if (payload.result.state === "ready") {
          setPending(null);
          try {
            sessionStorage.removeItem(storageKey);
          } catch {}
        }
      }
      await load();
    } catch (failure) {
      if (mounted.current && active.current === scope)
        setError(
          failure instanceof Error
            ? failure.message
            : "L’échange a été interrompu.",
        );
    } finally {
      if (mounted.current && active.current === scope) setBusy(false);
    }
  }
  async function confirm(requestId: string, quoteId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setInsufficientQuote(null);
    setReadError(null);
    readVersion.current++;
    try {
      const response = await fetch(`${endpoint}/confirm`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [PRICING_POLICY_HEADER]: LIVE_PRICING_POLICY_REVISION,
        },
        body: JSON.stringify(imageConfirmationPayload(requestId, quoteId)),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new ConversationRequestError(
          payload.error,
          payload.message ?? "La confirmation n’a pas pu être vérifiée.",
        );
      if (mounted.current && active.current === scope) {
        readVersion.current++;
        setConversation((current) => ({
          ...current,
          turns: current.turns.map((turn) =>
            turn.requestId === requestId
              ? {
                  ...turn,
                  quote: turn.quote
                    ? { ...turn.quote, state: "accepted" }
                    : null,
                  generation: payload.result,
                }
              : turn,
          ),
        }));
      }
    } catch (failure) {
      if (mounted.current && active.current === scope) {
        if (
          failure instanceof ConversationRequestError &&
          failure.code === "INSUFFICIENT_FUNDS"
        )
          setInsufficientQuote({ requestId, quoteId });
        setError(
          failure instanceof Error
            ? failure.message
            : "Vérifiez le résultat de la confirmation.",
        );
      }
    } finally {
      await load().catch(() => undefined);
      if (mounted.current && active.current === scope) setBusy(false);
    }
  }
  function discardPending() {
    setPending(null);
    setError(null);
    setInsufficientQuote(null);
    setReadError(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
  }
  const pendingTurn = conversation.turns.find(
    (turn) => turn.requestId === pending?.requestId,
  );
  const canResumePending =
    !!pending && !busy && (!pendingTurn || pendingTurn.state === "failed");
  return {
    conversation,
    busy,
    error: readError ?? error,
    needsFunds: !!insufficientQuote && !readError,
    pending,
    canResumePending,
    submit,
    confirm,
    refresh,
    discardPending,
  };
}
