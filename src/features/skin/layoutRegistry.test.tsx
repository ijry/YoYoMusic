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

  it("exposes skin summaries with layout descriptions for the skin manager", () => {
    expect(builtInLayoutSkinSummaries).toHaveLength(5);
    expect(builtInLayoutSkinSummaries[0]).toMatchObject({
      id: "classic-blue-silver",
      name: "经典蓝银分体机",
      builtIn: true,
      thumbnailClassName: "skin-thumbnail--classic-blue-silver",
    });
    expect(builtInLayoutSkinSummaries.map((skin) => skin.description)).toEqual([
      "蓝银金属主控舱、抽屉式播放列表、机械控制条。",
      "黑胶唱片居中，播放列表和歌词收束到右侧窄栏。",
      "玻璃浮层叠放，列表和功能标签像透明抽屉。",
      "频谱和均衡器优先，整体像金属音频机架。",
      "木质唱机台面，封面像唱片套，列表像专辑内页。",
    ]);
  });

  it("falls back to the default classic skin for unknown ids", () => {
    expect(DEFAULT_LAYOUT_SKIN_ID).toBe("classic-blue-silver");
    expect(resolveLayoutSkin("unknown-skin").id).toBe(DEFAULT_LAYOUT_SKIN_ID);
    expect(resolveLayoutSkin("dark-vinyl").id).toBe("dark-vinyl");
  });
});
