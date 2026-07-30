import { useEffect, useRef, useState } from "react";

export type LiveConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

export type UseEventSourceOptions = {
  /** When false, no EventSource and no poll. */
  enabled?: boolean;
  /** Named SSE events to listen for (e.g. "snapshot"). */
  events?: string[];
  onEvent?: (event: string, data: string) => void;
  onMessage?: (data: string) => void;
  /** Poll URL when SSE fails permanently or is unsupported. */
  pollUrl?: string;
  pollIntervalMs?: number;
  /** Called when poll returns JSON. */
  onPollJson?: (data: unknown) => void;
};

/**
 * Shared EventSource helper: connect, named events, reconnect awareness,
 * cleanup, and optional JSON poll fallback when the stream dies.
 */
export function useEventSource(
  url: string | null,
  options: UseEventSourceOptions = {},
): { status: LiveConnectionStatus } {
  const {
    enabled = true,
    events = ["snapshot"],
    onEvent,
    onMessage,
    pollUrl,
    pollIntervalMs = 10_000,
    onPollJson,
  } = options;

  const [status, setStatus] = useState<LiveConnectionStatus>("connecting");
  const onEventRef = useRef(onEvent);
  const onMessageRef = useRef(onMessage);
  const onPollJsonRef = useRef(onPollJson);
  onEventRef.current = onEvent;
  onMessageRef.current = onMessage;
  onPollJsonRef.current = onPollJson;

  useEffect(() => {
    if (!enabled || !url) {
      setStatus("offline");
      return;
    }

    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let sawOpen = false;
    let errorCount = 0;

    const stopPoll = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startPoll = () => {
      if (!pollUrl || pollTimer) return;
      setStatus("offline");
      const run = async () => {
        if (disposed) return;
        try {
          const res = await fetch(pollUrl, { credentials: "same-origin" });
          if (res.status === 401) {
            window.location.href = "/login";
            return;
          }
          if (!res.ok) return;
          const data: unknown = await res.json();
          onPollJsonRef.current?.(data);
        } catch {
          /* keep polling */
        }
      };
      void run();
      pollTimer = setInterval(() => void run(), pollIntervalMs);
    };

    const connect = () => {
      if (disposed) return;
      if (typeof EventSource === "undefined") {
        startPoll();
        return;
      }

      setStatus(sawOpen ? "reconnecting" : "connecting");
      es = new EventSource(url);

      es.onopen = () => {
        if (disposed) return;
        sawOpen = true;
        errorCount = 0;
        stopPoll();
        setStatus("live");
      };

      es.onmessage = (ev) => {
        onMessageRef.current?.(ev.data);
      };

      for (const name of events) {
        es.addEventListener(name, ((ev: MessageEvent) => {
          onEventRef.current?.(name, String(ev.data ?? ""));
        }) as EventListener);
      }

      es.onerror = () => {
        if (disposed) return;
        errorCount += 1;
        setStatus("reconnecting");
        // Browser auto-reconnects; after repeated errors, start poll fallback.
        if (errorCount >= 3) {
          try {
            es?.close();
          } catch {
            /* ignore */
          }
          es = null;
          startPoll();
          // Try reopening SSE periodically
          reconnectTimer = setTimeout(() => {
            if (disposed) return;
            stopPoll();
            errorCount = 0;
            connect();
          }, 30_000);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      stopPoll();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        es?.close();
      } catch {
        /* ignore */
      }
    };
  }, [url, enabled, pollUrl, pollIntervalMs, events.join("|")]);

  return { status };
}
