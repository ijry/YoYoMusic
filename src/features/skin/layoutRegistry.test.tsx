import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT_SKIN_ID,
  builtInLayoutSkinSummaries,
  builtInLayoutSkins,
  resolveLayoutSkin,
} from "./layoutRegistry";

describe("layout skin registry", () => {
  it("registers the five built-in layout skins in the expected order", () => {
    expect(builtInLayoutSkins.map((skin) => skin.id)).toEqual([
      "classic-blue-silver",
      "dark-vinyl",
      "transparent-crystal",
      "metal-rack",
      "warm-wood",
    ]);
    expect(builtInLayoutSkins).toHaveLength(5);
    expect(builtInLayoutSkins[0].name).toBe("经典蓝银分体机");
    expect(builtInLayoutSkins.every((skin) => typeof skin.Layout === "function")).toBe(true);
  });

  it("exposes machine-oriented skin summaries for the skin manager", () => {
    expect(builtInLayoutSkinSummaries).toHaveLength(5);
    expect(builtInLayoutSkinSummaries).toEqual([
      expect.objectContaining({
        id: "classic-blue-silver",
        name: "经典蓝银分体机",
        builtIn: true,
        thumbnailClassName: "skin-thumbnail--classic-blue-silver",
        tone: "旗舰分体机",
        description: "蓝背光主控舱、抽屉曲目仓、机械运输控制台。",
      }),
      expect.objectContaining({
        id: "dark-vinyl",
        builtIn: true,
        tone: "沉浸唱盘机",
        description: "中心唱盘舱、暗场字幕屏、竖向控制塔。",
      }),
      expect.objectContaining({
        id: "transparent-crystal",
        builtIn: true,
        tone: "概念透明机",
        description: "厚边透明外壳、抽拉资料匣、悬浮控制底座。",
      }),
      expect.objectContaining({
        id: "metal-rack",
        builtIn: true,
        tone: "专业机架机",
        description: "双仪表频谱桥、机柜信息屏、硬朗金属机架。",
      }),
      expect.objectContaining({
        id: "warm-wood",
        builtIn: true,
        tone: "家居唱机柜",
        description: "木质陈列窗、暖光铭牌屏、黄铜拨杆控制台。",
      }),
    ]);
  });

  it("falls back to the default classic skin for unknown ids", () => {
    expect(DEFAULT_LAYOUT_SKIN_ID).toBe("classic-blue-silver");
    expect(resolveLayoutSkin("unknown-skin").id).toBe(DEFAULT_LAYOUT_SKIN_ID);
    expect(resolveLayoutSkin("dark-vinyl").id).toBe("dark-vinyl");
  });
});
