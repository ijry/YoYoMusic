import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

it("renders the default classic layout skin landmarks", () => {
  const { container } = render(<App />);

  expect(container.querySelector(".skin-layout--classic-blue-silver")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "悠悠乐听" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "当前播放" })).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "功能面板" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "播放动态可视化" })).toBeInTheDocument();

  const controls = screen.getByRole("region", { name: "播放控制" });
  expect(within(controls).getByRole("button", { name: "播放" })).toBeInTheDocument();
  expect(within(controls).getByRole("slider", { name: "播放进度" })).toBeInTheDocument();
});

it("switches built-in layout skins in browser mode", async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  const windowActions = screen.getByRole("navigation", { name: "窗口操作" });
  await user.click(within(windowActions).getByRole("button", { name: "皮肤" }));
  expect(screen.getByRole("heading", { name: "皮肤管理" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "应用 暗夜黑胶舱" }));

  expect(container.querySelector(".skin-layout--classic-blue-silver")).not.toBeInTheDocument();
  expect(container.querySelector(".skin-layout--dark-vinyl")).toBeInTheDocument();
});
