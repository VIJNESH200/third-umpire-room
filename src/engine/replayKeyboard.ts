/**
 * replayKeyboard.ts
 *
 * Keyboard shortcuts for the canonical replay transport.
 *
 * This module only translates a keyboard event into a transport COMMAND. It
 * owns no clock and no state: the commands are executed by the single shared
 * transport in ConsoleLayout (`togglePlay` / `handleStep`), so stepping or
 * playing from the keyboard drives exactly the same timeline as the on-screen
 * buttons. No second timeline exists by construction.
 *
 * Shortcuts:
 *   SPACE         play / pause
 *   ArrowLeft     step back 1 frame
 *   ArrowRight    step forward 1 frame
 *   Shift+Left    step back 5 frames
 *   Shift+Right   step forward 5 frames
 */

export interface ReplayStepCommand {
  type: "STEP";
  frames: number;
}

export interface ReplayTogglePlayCommand {
  type: "TOGGLE_PLAY";
}

export type ReplayKeyCommand = ReplayStepCommand | ReplayTogglePlayCommand;

/** Frame counts for arrow steps; Shift multiplies the stride to 5 frames. */
const BASE_ARROW_FRAMES = 1;
const SHIFT_ARROW_FRAMES = 5;

/**
 * Whether the event target is a text-entry surface.
 *
 * Shortcuts must be ignored while the operator types in an input,
 * textarea, select or contenteditable region, or SPACE would toggle
 * playback mid-typing and arrows would steal caret movement.
 */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined") return false; // non-DOM environment
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Resolves a keydown into a transport command, or `null` when the key is
 * not a transport shortcut.
 *
 * `key` is the standard `KeyboardEvent.key` value; `shiftKey` its shift
 * modifier. Kept pure so the mapping is unit-testable without a browser.
 */
export function resolveReplayShortcut(
  key: string,
  shiftKey: boolean
): ReplayKeyCommand | null {
  if (key === " ") return { type: "TOGGLE_PLAY" };

  const frames = shiftKey ? SHIFT_ARROW_FRAMES : BASE_ARROW_FRAMES;
  if (key === "ArrowLeft") return { type: "STEP", frames: -frames };
  if (key === "ArrowRight") return { type: "STEP", frames };
  return null;
}
