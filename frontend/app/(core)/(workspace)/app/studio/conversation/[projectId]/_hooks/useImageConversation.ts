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
import {
  ConversationRequestError,
  conversationErrorMessage,
  conversationIssue,
  type ConversationIssue,
} from "../_lib/conversation-errors";

type ConversationRequests = {
  scope: string;
  initialized: boolean;
  mutationInFlight: boolean;
  readInFlight: boolean;
  readVersion: number;
  pending: ImageTurnInput | null;
  queuedReaders: {
    resolve: (value: ImageConversation | undefined) => void;
    reject: (error: unknown) => void;
  }[];
};

export function useImageConversation(
  projectId: string,
  accountKey: string,
  initialName: string,
  locale: "en" | "fr" = "en",
) {
  const scope = `${accountKey}:${projectId}`;
  const active = useRef<ConversationRequests | null>(null);
  // Each visit owns its requests, including when returning to the same project.
  if (!active.current || active.current.scope !== scope) {
    active.current = {
      scope, initialized: false, mutationInFlight: false, readInFlight: false,
      readVersion: 0, pending: null, queuedReaders: [],
    };
  }
  const requests = active.current;
  const [stateOwner, setStateOwner] = useState(requests);
  const currentState = stateOwner === requests;
  const name = useRef(initialName);
  name.current = initialName;
  const storageKey = `studio-image-pending:${scope}`;
  const endpoint = `/api/studio/projects/${encodeURIComponent(projectId)}/image-conversation`;
  const [conversation, setConversation] = useState<ImageConversation>({
    projectId,
    projectName: initialName,
    turns: [],
  });
  const [pending, setPending] = useState<ImageTurnInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ConversationIssue | null>(null);
  const [readError, setReadError] = useState<ConversationIssue | null>(null);
  const [insufficientQuote, setInsufficientQuote] = useState<{
    requestId: string;
    quoteId: string;
  } | null>(null);
  const mounted = useRef(true);
  const isCurrent = useCallback(
    () => mounted.current && active.current === requests,
    [requests],
  );
  const load = useCallback(async (): Promise<ImageConversation | undefined> => {
    if (!isCurrent()) return;
    if (requests.readInFlight) {
      return new Promise((resolve, reject) =>
        requests.queuedReaders.push({ resolve, reject }),
      );
    }
    requests.readInFlight = true;
    const version = requests.readVersion;
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new ConversationRequestError(payload.error);
      if (
        version === requests.readVersion &&
        isCurrent() &&
        acceptsImageConversationResponse(
          scope,
          active.current!.scope,
          payload.result.projectId,
          projectId,
        )
      ) {
        setConversation(payload.result);
        setReadError(null);
        const completedPending = payload.result.turns.find(
          (turn: { requestId: string; state: string }) =>
            turn.requestId === requests.pending?.requestId && turn.state === "ready",
        );
        if (completedPending) {
          requests.pending = null;
          setPending(null);
          setError((current) => current?.operation === "submit" ? null : current);
          try {
            sessionStorage.removeItem(storageKey);
          } catch {}
        }
        return payload.result as ImageConversation;
      }
    } catch (failure) {
      if (version === requests.readVersion && isCurrent()) throw failure;
    } finally {
      requests.readInFlight = false;
      const waiting = requests.queuedReaders.splice(0);
      if (waiting.length) {
        if (isCurrent()) {
          void load().then(
            (result) => waiting.forEach((reader) => reader.resolve(result)),
            (failure) => waiting.forEach((reader) => reader.reject(failure)),
          );
        } else waiting.forEach((reader) => reader.resolve(undefined));
      }
    }
  }, [endpoint, scope, projectId, storageKey, requests, isCurrent]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (requests.initialized) return;
    requests.initialized = true;
    setStateOwner(requests);
    setConversation({ projectId, projectName: name.current, turns: [] });
    setBusy(false);
    setLoading(true);
    setError(null);
    setReadError(null);
    setInsufficientQuote(null);
    try {
      const saved = sessionStorage.getItem(storageKey);
      requests.pending = saved ? imageTurnInputSchema.parse(JSON.parse(saved)) : null;
    } catch { requests.pending = null; }
    setPending(requests.pending);
    void load().catch((failure) => {
      if (isCurrent()) setReadError(conversationIssue("read", failure));
    }).finally(() => {
      if (isCurrent()) setLoading(false);
    });
  }, [load, projectId, storageKey, requests, isCurrent]);
  const needsPolling = currentState && (
    busy ||
    conversation.turns.some(
      (turn) =>
        turn.state === "thinking" ||
        turn.generation?.status === "running" ||
        turn.generation?.status === "accepted" ||
        (turn.quote &&
          ["claimed", "accepted"].includes(turn.quote.state) &&
          !turn.generation),
    )
  );
  useEffect(() => {
    if (!needsPolling) return;
    const timer = setInterval(() => {
      void load().catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [needsPolling, load]);
  const refresh = useCallback(async () => {
    if (!isCurrent()) return;
    try {
      const refreshed = await load();
      if (isCurrent() && refreshed) {
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
      if (isCurrent()) setReadError(conversationIssue("read", failure));
    }
  }, [load, isCurrent, insufficientQuote]);
  async function submit(input: ImageTurnInput) {
    if (!isCurrent() || requests.mutationInFlight) return;
    requests.mutationInFlight = true;
    requests.pending = input;
    setBusy(true);
    setError(null);
    setInsufficientQuote(null);
    setReadError(null);
    setPending(input);
    requests.readVersion++;
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
        throw new ConversationRequestError(payload.error);
      if (isCurrent()) {
        requests.readVersion++;
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
          requests.pending = null;
          setPending(null);
          try {
            sessionStorage.removeItem(storageKey);
          } catch {}
        }
      }
      await load().catch((failure) => {
        if (isCurrent()) setReadError(conversationIssue("read", failure));
      });
    } catch (failure) {
      if (isCurrent()) setError(conversationIssue("submit", failure));
    } finally {
      requests.mutationInFlight = false;
      if (isCurrent()) setBusy(false);
    }
  }
  async function confirm(requestId: string, quoteId: string) {
    if (!isCurrent() || requests.mutationInFlight) return;
    requests.mutationInFlight = true;
    setBusy(true);
    setError(null);
    setInsufficientQuote(null);
    setReadError(null);
    requests.readVersion++;
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
        throw new ConversationRequestError(payload.error);
      if (isCurrent()) {
        requests.readVersion++;
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
      if (isCurrent()) {
        if (
          failure instanceof ConversationRequestError &&
          failure.code === "INSUFFICIENT_FUNDS"
        )
          setInsufficientQuote({ requestId, quoteId });
        setError(conversationIssue("confirm", failure));
      }
    } finally {
      await load().catch(() => undefined);
      requests.mutationInFlight = false;
      if (isCurrent()) setBusy(false);
    }
  }
  function discardPending() {
    if (!isCurrent()) return;
    requests.pending = null;
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
  const canResumePending = currentState && !loading &&
    !!pending && !busy && (!pendingTurn || pendingTurn.state === "failed");
  const visibleError = currentState ? readError ?? error : null;
  return {
    conversation: currentState ? conversation : { projectId, projectName: initialName, turns: [] },
    busy: currentState && busy,
    loading: !currentState || loading,
    error: visibleError ? conversationErrorMessage(visibleError, locale) : null,
    errorCode: visibleError?.code ?? null,
    needsFunds: currentState && !!insufficientQuote && !readError,
    pending: currentState ? pending : null,
    canResumePending,
    submit,
    confirm,
    refresh,
    discardPending,
  };
}
