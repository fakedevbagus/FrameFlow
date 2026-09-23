import { useSyncExternalStore } from "react";
import type { TextOverlay } from "../project/domain";

export interface TextOverlayEditSession {
  clipId: string;
  overlay: TextOverlay;
}

let currentSession: TextOverlayEditSession | null = null;
const listeners = new Set<() => void>();

function areTextOverlaysEqual(left: TextOverlay, right: TextOverlay): boolean {
  return (
    left.text === right.text &&
    left.x === right.x &&
    left.y === right.y &&
    left.fontSize === right.fontSize &&
    left.color === right.color &&
    left.alignment === right.alignment
  );
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToTextOverlayEditSession(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTextOverlayEditSession(): TextOverlayEditSession | null {
  return currentSession;
}

export function useTextOverlayEditSession(): TextOverlayEditSession | null {
  return useSyncExternalStore(
    subscribeToTextOverlayEditSession,
    getTextOverlayEditSession,
    getTextOverlayEditSession,
  );
}

export function setTextOverlayEditSession(
  session: TextOverlayEditSession,
): void {
  if (
    currentSession?.clipId === session.clipId &&
    areTextOverlaysEqual(currentSession.overlay, session.overlay)
  ) {
    return;
  }

  currentSession = session;
  emitChange();
}

export function clearTextOverlayEditSession(): void {
  if (currentSession === null) {
    return;
  }

  currentSession = null;
  emitChange();
}
