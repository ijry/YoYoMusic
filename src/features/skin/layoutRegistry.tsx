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
    description: "蓝背光主控舱、抽屉曲目仓、机械运输控制台。",
    tone: "旗舰分体机",
    thumbnailClassName: "skin-thumbnail--classic-blue-silver",
    Layout: ClassicBlueSilverLayout,
  },
  {
    id: "dark-vinyl",
    name: "暗夜黑胶舱",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "中心唱盘舱、暗场字幕屏、竖向控制塔。",
    tone: "沉浸唱盘机",
    thumbnailClassName: "skin-thumbnail--dark-vinyl",
    Layout: DarkVinylLayout,
  },
  {
    id: "transparent-crystal",
    name: "透明水晶浮窗",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "厚边透明外壳、抽拉资料匣、悬浮控制底座。",
    tone: "概念透明机",
    thumbnailClassName: "skin-thumbnail--transparent-crystal",
    Layout: TransparentCrystalLayout,
  },
  {
    id: "metal-rack",
    name: "金属机架均衡器",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "双仪表频谱桥、机柜信息屏、硬朗金属机架。",
    tone: "专业机架机",
    thumbnailClassName: "skin-thumbnail--metal-rack",
    Layout: MetalRackLayout,
  },
  {
    id: "warm-wood",
    name: "暖木复古唱机",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "木质陈列窗、暖光铭牌屏、黄铜拨杆控制台。",
    tone: "家居唱机柜",
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
