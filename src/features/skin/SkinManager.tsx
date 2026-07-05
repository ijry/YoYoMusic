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

  useEffect(() => {
    setPreviewSkinId(activeSkinId);
  }, [activeSkinId]);

  return (
    <section className="skin-manager" aria-labelledby="skin-manager-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Skins</p>
          <h2 id="skin-manager-title">皮肤管理</h2>
        </div>
        <button type="button" onClick={onImport}>
          导入皮肤包
        </button>
      </div>

      <p className="skin-manager__note">内置机型会改变整体机身布局；导入皮肤包只应用颜色和资源，不改变布局。</p>

      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}

      <div className="skin-grid">
        {skins.map((skin) => {
          const isActive = skin.id === activeSkinId;
          const isPreviewing = skin.id === previewSkinId && !isActive;
          const thumbnailClassName = skin.thumbnailClassName ?? "skin-thumbnail--custom";

          return (
            <article key={skin.id} className={isActive ? "skin-card is-active" : "skin-card"}>
              <div className={`skin-thumbnail ${thumbnailClassName}`} role="img" aria-label={`${skin.name} 布局缩略图`}>
                <span />
                <span />
                <span />
              </div>

              <div className="skin-card__copy">
                <p className="skin-card__tone">{skin.tone ?? (skin.builtIn ? "内置布局" : "导入主题")}</p>
                <h3>{skin.name}</h3>
                <p className="skin-card__meta">
                  {skin.builtIn ? "内置机型" : "导入主题"} · {skin.author} · {skin.version}
                </p>
                {skin.description ? <p>{skin.description}</p> : null}
              </div>

              <div className="skin-card__status">
                {isActive ? <span>当前皮肤</span> : null}
                {isPreviewing ? <span>预览中</span> : null}
              </div>

              <div className="skin-card__actions">
                <button type="button" onClick={() => setPreviewSkinId(skin.id)}>
                  预览 {skin.name}
                </button>
                <button type="button" onClick={() => onApply(skin.id)}>
                  应用 {skin.name}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
