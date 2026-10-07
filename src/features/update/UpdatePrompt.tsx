import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../shared/icons";
import type { UpdateChecker, UpdateStatus } from "./useUpdateChecker";

interface UpdatePromptProps {
  checker: UpdateChecker;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

/*
 * The notes are the annotated tag message, which is Markdown — the release page
 * renders it, but plain text here showed the literal `##` and `-`. This handles
 * the three things a changelog actually uses: headings, bullets and paragraphs.
 *
 * It builds elements rather than HTML, so a release body can never inject
 * markup into the app.
 */
function ReleaseNotes({ notes }: { notes: string }) {
  const blocks: Array<{ kind: "heading" | "item" | "text"; text: string }> = [];

  for (const raw of notes.split("\n")) {
    const line = raw.trimEnd();
    if (line.trim().length === 0) continue;

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", text: heading[1].trim() });
      continue;
    }

    const item = line.match(/^\s*[-*+]\s+(.*)$/);
    if (item) {
      blocks.push({ kind: "item", text: item[1].trim() });
      continue;
    }

    blocks.push({ kind: "text", text: line.trim() });
  }

  if (blocks.length === 0) return null;

  return (
    <div className="update-card__notes">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <strong className="update-card__notes-heading" key={index}>
              {block.text}
            </strong>
          );
        }
        if (block.kind === "item") {
          return (
            <span className="update-card__notes-item" key={index}>
              {block.text}
            </span>
          );
        }
        return (
          <span className="update-card__notes-text" key={index}>
            {block.text}
          </span>
        );
      })}
    </div>
  );
}

/*
 * The update dialog.
 *
 * Portalled to <body> and fixed-positioned, because every `.modern-panel` sets
 * `overflow: hidden` — inside one, the dialog would be clipped to its parent and
 * its buttons could not be clicked.
 *
 * Windows installs and exits on its own after `downloadAndInstall`, so the
 * relaunch button only appears where it is actually needed.
 */
export function UpdatePrompt({ checker }: UpdatePromptProps) {
  const { status } = checker;
  const visible =
    status.kind === "available" || status.kind === "downloading" || status.kind === "ready";

  useEffect(() => {
    if (!visible) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && status.kind === "available") checker.dismiss();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visible, status.kind, checker]);

  if (!visible) return null;

  const update = status.update;
  const progress =
    status.kind === "downloading" && status.progress.total
      ? Math.min(100, Math.round((status.progress.downloaded / status.progress.total) * 100))
      : null;

  return createPortal(
    <div className="update-overlay">
      <div className="update-card" role="dialog" aria-modal="true" aria-label="软件更新">
        <header className="update-card__head">
          <span className="update-card__mark" aria-hidden="true">
            {status.kind === "ready" ? <Icon.updateReady size={18} /> : <Icon.updateAvailable size={18} />}
          </span>
          <div className="update-card__titles">
            <strong>
              {status.kind === "ready" ? "更新已下载" : `发现新版本 ${update.version}`}
            </strong>
            <span>当前版本 {update.currentVersion}</span>
          </div>
          {status.kind === "available" ? (
            <button
              type="button"
              className="update-card__close"
              /* Not "稍后": that is the label of the defer button below, and two
               * controls announcing nearly the same thing is ambiguous. */
              aria-label="关闭更新提示"
              title="关闭"
              onClick={checker.dismiss}
            >
              <Icon.remove size={16} />
            </button>
          ) : null}
        </header>

        {update.notes && status.kind === "available" ? (
          <ReleaseNotes notes={update.notes} />
        ) : null}

        {status.kind === "downloading" ? (
          <div className="update-card__progress">
            <div className="update-card__progress-head">
              <span>正在下载</span>
              <span>
                {formatBytes(status.progress.downloaded)}
                {status.progress.total ? ` / ${formatBytes(status.progress.total)}` : ""}
              </span>
            </div>
            <div className="update-card__bar">
              <span style={{ width: `${progress ?? 12}%` }} data-indeterminate={progress === null} />
            </div>
          </div>
        ) : null}

        <footer className="update-card__actions">
          {status.kind === "available" ? (
            <>
              <button type="button" className="update-button" onClick={checker.dismiss}>
                稍后
              </button>
              <button
                type="button"
                className="update-button update-button--primary"
                onClick={checker.install}
              >
                <Icon.updateAvailable size={16} />
                立即更新
              </button>
            </>
          ) : null}

          {status.kind === "downloading" ? (
            <button type="button" className="update-button" disabled>
              <Icon.updateCheck size={16} />
              下载中…
            </button>
          ) : null}

          {status.kind === "ready" ? (
            <button
              type="button"
              className="update-button update-button--primary"
              onClick={checker.relaunch}
            >
              <Icon.updateRestart size={16} />
              重启以完成更新
            </button>
          ) : null}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/** Inline status for the settings panel. */
export function UpdateStatusLine({ status }: { status: UpdateStatus }) {
  const text =
    status.kind === "checking"
      ? "正在检查…"
      : status.kind === "up-to-date"
        ? "已是最新版本"
        : status.kind === "available"
          ? `发现新版本 ${status.update.version}`
          : status.kind === "downloading"
            ? "正在下载更新…"
            : status.kind === "ready"
              ? "更新已下载，重启后生效"
              : status.kind === "error"
                ? `检查失败：${status.message}`
                : "尚未检查";

  return (
    <span className="update-status-line" data-kind={status.kind}>
      {text}
    </span>
  );
}
