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
    description: "蓝背光主控舱、抽屉曲目仓、机械运输控制台。",
    tone: "旗舰分体机",
    thumbnailClassName: "skin-thumbnail--classic-blue-silver",
    builtIn: true,
  },
  {
    id: "dark-vinyl",
    name: "暗夜黑胶舱",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "中心唱盘舱、暗场字幕屏、竖向控制塔。",
    tone: "沉浸唱盘机",
    thumbnailClassName: "skin-thumbnail--dark-vinyl",
    builtIn: true,
  },
];

describe("SkinManager", () => {
  it("previews and applies a built-in machine skin", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const { container } = render(
      <SkinManager
        skins={builtInSkins}
        activeSkinId="classic-blue-silver"
        error={null}
        onApply={onApply}
      />,
    );

    expect(screen.getByText("内置机型会改变整体机身布局；导入皮肤包只应用颜色和资源，不改变布局。")).toBeInTheDocument();
    expect(screen.getByText("旗舰分体机")).toBeInTheDocument();
    expect(screen.getAllByText("内置机型 · YoYoMusic · 1.0.0")).toHaveLength(2);
    expect(container.querySelector(".skin-manager__status")).toHaveTextContent("2 套可用机型");
    expect(container.querySelectorAll(".skin-card__machine-id")).toHaveLength(2);
    expect(container.querySelector(".skin-card__frame")).toBeInTheDocument();

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
    expect(screen.getByText("内置机型会改变整体机身布局；导入皮肤包只应用颜色和资源，不改变布局。")).toBeInTheDocument();
  });
});
