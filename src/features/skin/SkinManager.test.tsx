import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkinManager } from "./SkinManager";

describe("SkinManager", () => {
  it("previews and applies a valid skin", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <SkinManager
        skins={[{ id: "classic", name: "怀旧经典", author: "YoYoMusic", version: "1.0.0" }]}
        activeSkinId="default"
        error={null}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole("button", { name: "应用 怀旧经典" }));

    expect(onApply).toHaveBeenCalledWith("classic");
  });

  it("shows invalid package messages", () => {
    render(<SkinManager skins={[]} activeSkinId="default" error="manifest 缺失" onApply={() => undefined} />);
    expect(screen.getByText("manifest 缺失")).toBeInTheDocument();
  });
});
