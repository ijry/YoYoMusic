import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT_SKIN_ID,
  builtInLayoutSkinSummaries,
  builtInLayoutSkins,
  resolveLayoutSkin,
} from "./layoutRegistry";

describe("layout skin registry", () => {
  it("registers the four modern skins in the expected order", () => {
    expect(builtInLayoutSkins.map((skin) => skin.id)).toEqual([
      "aurora-glass",
      "midnight-neon",
      "sunset-blaze",
      "mint-studio",
    ]);
    expect(builtInLayoutSkins).toHaveLength(4);
    expect(builtInLayoutSkins[0].name).toBe("极光玻璃");
    expect(builtInLayoutSkins.every((skin) => typeof skin.Layout === "function")).toBe(true);
  });

  it("exposes palette-oriented skin summaries for the skin manager", () => {
    expect(builtInLayoutSkinSummaries).toHaveLength(4);
    expect(builtInLayoutSkinSummaries).toEqual([
      expect.objectContaining({
        id: "aurora-glass",
        name: "极光玻璃",
        builtIn: true,
        thumbnailClassName: "skin-thumbnail--aurora-glass",
        tone: "极光渐变",
        description: "紫青极光渐变、深色毛玻璃主舱。",
      }),
      expect.objectContaining({
        id: "midnight-neon",
        builtIn: true,
        tone: "霓虹夜色",
        description: "品红霓虹灯管、午夜蓝紫玻璃。",
      }),
      expect.objectContaining({
        id: "sunset-blaze",
        builtIn: true,
        tone: "暖色落日",
        description: "落日橙金渐变、暖调毛玻璃。",
      }),
      expect.objectContaining({
        id: "mint-studio",
        builtIn: true,
        tone: "清冷录音室",
        description: "薄荷青绿、冷调录音室玻璃。",
      }),
    ]);
  });

  it("falls back to the default aurora skin for unknown ids", () => {
    expect(DEFAULT_LAYOUT_SKIN_ID).toBe("aurora-glass");
    expect(resolveLayoutSkin("unknown-skin").id).toBe(DEFAULT_LAYOUT_SKIN_ID);
    expect(resolveLayoutSkin("midnight-neon").id).toBe("midnight-neon");
  });
});
