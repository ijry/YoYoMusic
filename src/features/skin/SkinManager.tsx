import { useEffect, useState } from "react";

export interface SkinSummary {
  id: string;
  name: string;
  author: string;
  version: string;
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

      {error ? <p role="alert" className="error-text">{error}</p> : null}

      <div className="skin-grid">
        {skins.map((skin) => (
          <article key={skin.id} className="skin-card">
            <h3>{skin.name}</h3>
            <p>
              {skin.author} · {skin.version}
            </p>
            {skin.id === activeSkinId ? <span>当前皮肤</span> : null}
            {skin.id === previewSkinId && skin.id !== activeSkinId ? <span>预览中</span> : null}
            <button type="button" onClick={() => setPreviewSkinId(skin.id)}>
              预览 {skin.name}
            </button>
            <button type="button" onClick={() => onApply(skin.id)}>
              应用 {skin.name}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
