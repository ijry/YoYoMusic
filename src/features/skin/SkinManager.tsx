import { useEffect, useState } from "react";

export interface SkinSummary {
  id: string;
  name: string;
  author: string;
  version: string;
  description?: string;
  tone?: string;
  thumbnailClassName?: string;
  builtIn?: boolean;
}

interface SkinManagerProps {
  skins: SkinSummary[];
  activeSkinId: string;
  error: string | null;
  onApply: (skinId: string) => void;
  onImport?: () => void;
}

export function SkinManager({ skins, activeSkinId, error, onApply, onImport }: SkinManagerProps) {
  const [previewSkinId, setPreviewSkinId] = useState(activeSkinId);
  const builtInCount = skins.filter((skin) => skin.builtIn).length;

  useEffect(() => {
    setPreviewSkinId(activeSkinId);
  }, [activeSkinId]);

  return (
    <section className="skin-manager" aria-labelledby="skin-manager-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Skin Library</p>
          <h2 id="skin-manager-title">皮肤库</h2>
        </div>
        <button type="button" onClick={onImport}>
          导入皮肤包
        </button>
      </div>

      <p className="skin-manager__note">内置皮肤会切换整个播放器布局；导入皮肤包只替换颜色和资源。</p>
      <p className="skin-manager__status">{builtInCount > 0 ? `${builtInCount} 套内置皮肤` : `${skins.length} 套可用主题`}</p>

      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}

      <div className="skin-manager__grid" aria-label="可用皮肤">
        {skins.map((skin) => {
          const isActive = skin.id === activeSkinId;
          const isPreviewing = skin.id === previewSkinId && !isActive;
          const thumbnailClassName = skin.thumbnailClassName ?? "skin-thumbnail--custom";

          return (
            <article
              key={skin.id}
              className={["skin-card", isActive ? "is-active" : "", isPreviewing ? "is-previewing" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className="skin-card__preview-button"
                aria-label={`预览 ${skin.name}`}
                aria-pressed={isPreviewing || isActive}
                onClick={() => setPreviewSkinId(skin.id)}
              >
                <span className="skin-card__frame" aria-hidden="true">
                  <span className={`skin-thumbnail ${thumbnailClassName}`}>
                    <span />
                    <span />
                    <span />
                  </span>
                </span>

                <span className="skin-card__copy">
                  <span className="skin-card__tone">{skin.tone ?? (skin.builtIn ? "内置皮肤" : "导入主题")}</span>
                  <span className="skin-card__name">{skin.name}</span>
                  <span className="skin-card__meta">
                    {skin.builtIn ? "内置皮肤" : "导入主题"} · {skin.author} · {skin.version}
                  </span>
                  {skin.description ? <span className="skin-card__description">{skin.description}</span> : null}
                </span>
              </button>

              <div className="skin-card__status">
                {isActive ? <span>当前使用</span> : null}
                {isPreviewing ? <span>预览中</span> : null}
              </div>

              <div className="skin-card__actions">
                <button
                  type="button"
                  className="skin-card__apply-button"
                  aria-label={isActive ? `使用中 ${skin.name}` : `应用 ${skin.name}`}
                  disabled={isActive}
                  onClick={() => onApply(skin.id)}
                >
                  {isActive ? "使用中" : "应用"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
