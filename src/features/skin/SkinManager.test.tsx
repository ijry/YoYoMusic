import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkinManager, type SkinSummary } from "./SkinManager";

const builtInSkins: SkinSummary[] = [
  {
    id: "classic-blue-silver",
    name: "经典蓝银分体机",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "蓝银金属主控舱、抽屉式播放列表、机械控制条。",
    tone: "默认主打",
    thumbnailClassName: "skin-thumbnail--classic-blue-silver",
    builtIn: true,
  },
  {
    id: "dark-vinyl",
    name: "暗夜黑胶舱",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "黑胶唱片居中，播放列表和歌词收束到右侧窄栏。",
    tone: "沉浸播放",
    thumbnailClassName: "skin-thumbnail--dark-vinyl",
    builtIn: true,
  },
];

describe("SkinManager", () => {
  it("previews and applies a built-in layout skin", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <SkinManager
        skins={builtInSkins}
        activeSkinId="classic-blue-silver"
        error={null}
        onApply={onApply}
      />,
    );

    expect(screen.getByRole("img", { name: "经典蓝银分体机 布局缩略图" })).toBeInTheDocument();
    expect(screen.getByText("默认主打")).toBeInTheDocument();
    expect(screen.getByText("蓝银金属主控舱、抽屉式播放列表、机械控制条。")).toBeInTheDocument();
    expect(screen.getByText("当前皮肤")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "预览 暗夜黑胶舱" }));
    expect(screen.getByText("预览中")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "应用 暗夜黑胶舱" }));
    expect(onApply).toHaveBeenCalledWith("dark-vinyl");
  });

  it("shows imported skin limitation copy and invalid package messages", () => {
    render(
      <SkinManager
        skins={[{ id: "imported", name: "导入皮肤", author: "User", version: "1.0.0" }]}
        activeSkinId="classic-blue-silver"
        error="manifest 缺失"
        onApply={() => undefined}
      />,
    );

    expect(screen.getByText("manifest 缺失")).toBeInTheDocument();
    expect(screen.getByText("导入皮肤包只应用颜色和资源，不改变布局。")).toBeInTheDocument();
  });
});
