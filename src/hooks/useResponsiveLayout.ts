import { useSyncExternalStore } from 'react';

/* ─── Responsive layout hook ───
   Viewport-width based (never user-agent sniffing) so it follows the actual
   available space, including split-screen and window resizing.

     ≥ 1024 px  → desktop layout (unchanged 3-column UI)
     <  1024 px → compact layout (canvas + bottom toolbar + drawer sheets)

   A separate coarse-pointer query tells the UI when touch is the primary
   input (used for hint text, not for behavior — behavior adapts per-event
   via event.pointerType). */

const COMPACT_QUERY = '(max-width: 1023px)';
const COARSE_QUERY = '(any-pointer: coarse)';

function subscribe(query: string, callback: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getCompact() {
  return window.matchMedia(COMPACT_QUERY).matches;
}

function getCoarse() {
  return window.matchMedia(COARSE_QUERY).matches;
}

function noopSnapshot() {
  return false;
}

/** True when the viewport is narrower than the desktop layout (tablet/phone). */
export function useResponsiveLayout(): boolean {
  return useSyncExternalStore(
    (cb) => subscribe(COMPACT_QUERY, cb),
    getCompact,
    noopSnapshot,
  );
}

/** True when any touch/pen pointer exists on the device (hybrid laptops included). */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    (cb) => subscribe(COARSE_QUERY, cb),
    getCoarse,
    noopSnapshot,
  );
}
