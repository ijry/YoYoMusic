import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../shared/icons";

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (value: number) => void;
  onToggleMuted: () => void;
}

/*
 * Volume lives behind a popover rather than a permanent number box: the deck is
 * a fixed-height row, and a text field there reads as a form, not a transport.
 * The slider is horizontal like the progress rail above it and fills with the
 * same skin gradient, so the two read as one family.
 *
 * The popover is **portalled to <body>** and positioned from the trigger's
 * measured rect. That is not gold-plating: every `.modern-panel` sets
 * `overflow: hidden` so its own content cannot spill past its rounded corners,
 * and the deck is one of those panels. Rendered in place, the popover is clipped
 * by the transport panel — the mute button inside it becomes genuinely
 * unclickable, with no visual hint that anything is wrong. It also has to be
 * fixed-position so opening it cannot reflow the deck, which sits in the last
 * row of a `grid-template-rows: auto minmax(0, 1fr) auto` shell.
 */

const POPOVER_WIDTH = 208;
const GAP = 10;
const EDGE = 8;

export function VolumeControl({ volume, isMuted, onVolumeChange, onToggleMuted }: VolumeControlProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  const percent = Math.round(volume * 100);

  // Measure before paint so the popover never appears at a stale position.
  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }

    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const half = POPOVER_WIDTH / 2;
      // Clamp horizontally so the panel stays on screen near the window edges.
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - half, EDGE),
        window.innerWidth - POPOVER_WIDTH - EDGE,
      );
      setAnchor({ left, bottom: window.innerHeight - rect.top + GAP });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Click anywhere else, or press Escape, to dismiss.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Return focus to the trigger so keyboard users are not stranded.
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="volume-control" data-open={open ? "true" : "false"}>
      <button
        ref={triggerRef}
        type="button"
        className="transport-button transport-button--volume"
        aria-label="音量"
        aria-expanded={open}
        aria-controls={popoverId}
        title={`音量 ${percent}%`}
        onClick={() => setOpen((current) => !current)}
      >
        {isMuted ? <Icon.muted size={18} /> : <Icon.volume size={18} />}
      </button>

      {/*
       * Portalled out of the panel. It stays mounted only while open so the
       * slider never leaves the tab order mid-interaction, and Escape returns
       * focus to the trigger.
       */}
      {open && anchor
        ? createPortal(
            <div
              ref={popoverRef}
              className="volume-popover"
              id={popoverId}
              role="group"
              aria-label="音量调节"
              style={{ left: `${anchor.left}px`, bottom: `${anchor.bottom}px` }}
            >
              <div className="volume-popover__head">
                <span className="volume-popover__icon" aria-hidden="true">
                  {isMuted ? <Icon.muted size={16} /> : <Icon.volume size={16} />}
                </span>
                <span className="volume-popover__value">{isMuted ? "已静音" : `${percent}%`}</span>
                <button
                  type="button"
                  className="volume-popover__mute"
                  aria-pressed={isMuted}
                  aria-label={isMuted ? "取消静音" : "静音"}
                  title={isMuted ? "取消静音" : "静音"}
                  onClick={onToggleMuted}
                >
                  {isMuted ? <Icon.volume size={15} /> : <Icon.muted size={15} />}
                </button>
              </div>

              {/*
               * The trigger is "音量" and this slider "音量大小": two elements
               * must not share an accessible name, or
               * `getByRole(..., { name })` becomes ambiguous while open.
               */}
              <input
                aria-label="音量大小"
                className="volume-slider"
                type="range"
                min={0}
                max={100}
                step={1}
                value={percent}
                style={{ "--progress": `${percent}%` } as React.CSSProperties}
                onChange={(event) => onVolumeChange(Number(event.currentTarget.value) / 100)}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
