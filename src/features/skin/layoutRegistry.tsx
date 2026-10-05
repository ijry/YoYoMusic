import type { SkinSummary } from "./SkinManager";
import type { LayoutSkinDefinition } from "./layoutTypes";
import {
  AuroraGlassLayout,
  MidnightNeonLayout,
  MintStudioLayout,
  SunsetBlazeLayout,
} from "./layouts";

export const DEFAULT_LAYOUT_SKIN_ID = "aurora-glass";

export const builtInLayoutSkins: LayoutSkinDefinition[] = [
  {
    id: "aurora-glass",
    name: "极光玻璃",
    author: "YoYoMusic",
    version: "2.0.0",
    description: "紫青极光渐变、深色毛玻璃主舱。",
    tone: "极光渐变",
    thumbnailClassName: "skin-thumbnail--aurora-glass",
    Layout: AuroraGlassLayout,
  },
  {
    id: "midnight-neon",
    name: "午夜霓虹",
    author: "YoYoMusic",
    version: "2.0.0",
    description: "品红霓虹灯管、午夜蓝紫玻璃。",
    tone: "霓虹夜色",
    thumbnailClassName: "skin-thumbnail--midnight-neon",
    Layout: MidnightNeonLayout,
  },
  {
    id: "sunset-blaze",
    name: "落日熔金",
    author: "YoYoMusic",
    version: "2.0.0",
    description: "落日橙金渐变、暖调毛玻璃。",
    tone: "暖色落日",
    thumbnailClassName: "skin-thumbnail--sunset-blaze",
    Layout: SunsetBlazeLayout,
  },
  {
    id: "mint-studio",
    name: "薄荷录音室",
    author: "YoYoMusic",
    version: "2.0.0",
    description: "薄荷青绿、冷调录音室玻璃。",
    tone: "清冷录音室",
    thumbnailClassName: "skin-thumbnail--mint-studio",
    Layout: MintStudioLayout,
  },
];

export const builtInLayoutSkinSummaries: SkinSummary[] = builtInLayoutSkins.map(
  ({ id, name, author, version, description, tone, thumbnailClassName }) => ({
    id,
    name,
    author,
    version,
    description,
    tone,
    thumbnailClassName,
    builtIn: true,
  }),
);

export function resolveLayoutSkin(skinId: string) {
  return builtInLayoutSkins.find((skin) => skin.id === skinId) ?? builtInLayoutSkins[0];
}
