/**
 * Pure chat-turn lifecycle. No React, no I/O — the hook dispatches events here.
 *
 * idle → sending → streaming → finalizing → idle
 * any active phase → error | aborted → idle (via reset)
 */

export type ChatTurnPhase =
  | "idle"
  | "sending"
  | "streaming"
  | "finalizing"
  | "error"
  | "aborted";

export type ChatTurnState = {
  phase: ChatTurnPhase;
  /** Assistant message id (temp or durable) currently being filled */
  assistantId: string | null;
  /** Accumulated assistant text for the active turn */
  text: string;
  /** Last human-readable error for the active turn */
  errorMessage: string | null;
  /** Conversation id once known (meta) */
  conversationId: string | null;
};

export type ChatTurnEvent =
  | { type: "send"; assistantId: string }
  | { type: "meta"; conversationId: string; assistantId?: string }
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; message: string }
  | { type: "abort" }
  | { type: "finalize_done" }
  | { type: "reset" };

export const initialChatTurnState: ChatTurnState = {
  phase: "idle",
  assistantId: null,
  text: "",
  errorMessage: null,
  conversationId: null,
};

export function reduceChatTurn(
  state: ChatTurnState,
  event: ChatTurnEvent,
): ChatTurnState {
  switch (event.type) {
    case "reset":
      return { ...initialChatTurnState };

    case "send":
      if (state.phase !== "idle" && state.phase !== "error" && state.phase !== "aborted") {
        // New send supersedes prior terminal or stuck state
      }
      return {
        phase: "sending",
        assistantId: event.assistantId,
        text: "",
        errorMessage: null,
        conversationId: state.conversationId,
      };

    case "meta":
      if (state.phase !== "sending" && state.phase !== "streaming") {
        return state;
      }
      return {
        ...state,
        phase: "streaming",
        conversationId: event.conversationId,
        assistantId: event.assistantId ?? state.assistantId,
      };

    case "text":
      if (state.phase !== "sending" && state.phase !== "streaming") {
        return state;
      }
      return {
        ...state,
        phase: "streaming",
        text: state.text + event.text,
      };

    case "done":
      if (
        state.phase !== "streaming" &&
        state.phase !== "sending" &&
        state.phase !== "finalizing"
      ) {
        return state;
      }
      return {
        ...state,
        phase: "finalizing",
      };

    case "finalize_done":
      if (state.phase !== "finalizing" && state.phase !== "streaming") {
        return state;
      }
      return {
        ...state,
        phase: "idle",
      };

    case "error":
      if (state.phase === "idle") return state;
      return {
        ...state,
        phase: "error",
        errorMessage: event.message,
      };

    case "abort":
      if (state.phase === "idle") return state;
      return {
        ...state,
        phase: "aborted",
      };

    default:
      return state;
  }
}

/** True while the turn should show a stop control / block double-send. */
export function chatTurnIsBusy(state: ChatTurnState): boolean {
  return (
    state.phase === "sending" ||
    state.phase === "streaming" ||
    state.phase === "finalizing"
  );
}
