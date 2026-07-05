import type { SkinSummary } from "./SkinManager";
import type { LayoutSkinDefinition } from "./layoutTypes";
import {
  ClassicBlueSilverLayout,
  DarkVinylLayout,
  MetalRackLayout,
  TransparentCrystalLayout,
  WarmWoodLayout,
} from "./layouts";

export const DEFAULT_LAYOUT_SKIN_ID = "classic-blue-silver";

export const builtInLayoutSkins: LayoutSkinDefinition[] = [
  {
    id: "classic-blue-silver",
    name: "经典蓝银分体机",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "蓝银金属主控舱、抽屉式播放列表、机械控制条。",
    tone: "默认主打",
    thumbnailClassName: "skin-thumbnail--classic-blue-silver",
    Layout: ClassicBlueSilverLayout,
  },
  {
    id: "dark-vinyl",
    name: "暗夜黑胶舱",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "黑胶唱片居中，播放列表和歌词收束到右侧窄栏。",
    tone: "沉浸播放",
    thumbnailClassName: "skin-thumbnail--dark-vinyl",
    Layout: DarkVinylLayout,
  },
  {
    id: "transparent-crystal",
    name: "透明水晶浮窗",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "玻璃浮层叠放，列表和功能标签像透明抽屉。",
    tone: "轻盈透明",
    thumbnailClassName: "skin-thumbnail--transparent-crystal",
    Layout: TransparentCrystalLayout,
  },
  {
    id: "metal-rack",
    name: "金属机架均衡器",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "频谱和均衡器优先，整体像金属音频机架。",
    tone: "发烧设备",
    thumbnailClassName: "skin-thumbnail--metal-rack",
    Layout: MetalRackLayout,
  },
  {
    id: "warm-wood",
    name: "暖木复古唱机",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "木质唱机台面，封面像唱片套，列表像专辑内页。",
    tone: "温暖复古",
    thumbnailClassName: "skin-thumbnail--warm-wood",
    Layout: WarmWoodLayout,
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
