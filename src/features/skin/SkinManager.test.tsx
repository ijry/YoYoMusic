import { render, screen, within } from "@testing-library/react";
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
  it("previews from the card body and applies a built-in skin with one primary action", async () => {
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

    expect(screen.getByRole("heading", { name: "皮肤库" })).toBeInTheDocument();
    expect(screen.getByText("内置皮肤会切换整个播放器布局；导入皮肤包只替换颜色和资源。")).toBeInTheDocument();
    expect(container.querySelector(".skin-manager__status")).toHaveTextContent("2 套内置皮肤");
    expect(container.querySelectorAll(".skin-card__preview-button")).toHaveLength(2);
    expect(container.querySelectorAll(".skin-card__apply-button")).toHaveLength(2);
    expect(container.querySelectorAll(".skin-card__machine-id")).toHaveLength(0);

    const activeApplyButton = screen.getByRole("button", { name: "使用中 经典蓝银分体机" });
    expect(activeApplyButton).toBeDisabled();
    expect(activeApplyButton).toHaveTextContent("使用中");
    expect(screen.getByText("当前使用")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "预览 暗夜黑胶舱" }));
    expect(screen.getByText("预览中")).toBeInTheDocument();
    expect(container.querySelector(".skin-card.is-previewing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "应用 暗夜黑胶舱" }));
    expect(onApply).toHaveBeenCalledWith("dark-vinyl");

    const previewButton = screen.getByRole("button", { name: "预览 暗夜黑胶舱" });
    expect(within(previewButton).getByText("暗夜黑胶舱")).toBeInTheDocument();
    expect(within(previewButton).getByText("沉浸唱盘机")).toBeInTheDocument();
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

    expect(screen.getByRole("alert")).toHaveTextContent("manifest 缺失");
    expect(screen.getByText("内置皮肤会切换整个播放器布局；导入皮肤包只替换颜色和资源。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "皮肤库" })).toBeInTheDocument();
  });
});
