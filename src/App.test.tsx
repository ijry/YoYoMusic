import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

it("renders the default modern layout skin landmarks", () => {
  const { container } = render(<App />);

  expect(container.querySelector(".skin-layout--aurora-glass")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "悠悠乐听" })).toBeInTheDocument();
  expect(screen.getByText("极光玻璃")).toBeInTheDocument();
  expect(screen.queryByText("本地音乐播放器")).not.toBeInTheDocument();
  expect(screen.queryByText("蓝银经典皮肤")).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "当前播放" })).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "功能面板" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "播放动态可视化" })).toBeInTheDocument();

  const windowActions = screen.getByRole("navigation", { name: "窗口操作" });
  expect(within(windowActions).getByRole("button", { name: "皮肤" })).toBeInTheDocument();
  expect(within(windowActions).getByRole("button", { name: "设置" })).toBeInTheDocument();
  expect(within(windowActions).getByRole("button", { name: "迷你" })).toBeInTheDocument();
  expect(within(windowActions).getByRole("button", { name: "桌面歌词" })).toBeInTheDocument();
  expect(screen.queryByText("SKN")).not.toBeInTheDocument();
  expect(screen.queryByText("CFG")).not.toBeInTheDocument();
  expect(screen.queryByText("MINI")).not.toBeInTheDocument();
  expect(screen.queryByText("LRC")).not.toBeInTheDocument();

  const controls = screen.getByRole("region", { name: "播放控制" });
  expect(within(controls).getByRole("button", { name: "播放" })).toBeInTheDocument();
  expect(within(controls).getByRole("slider", { name: "播放进度" })).toBeInTheDocument();
});

it("starts with the feature inspector collapsed and opens it from the icon rail", async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  // Rail is always there; the drawer is not.
  expect(screen.getByRole("complementary", { name: "功能面板" })).toBeInTheDocument();
  expect(container.querySelectorAll(".feature-rail .feature-tab")).toHaveLength(6);
  expect(container.querySelector(".feature-drawer")).not.toBeInTheDocument();
  expect(container.querySelector(".modern-grid")).toHaveAttribute("data-inspector", "closed");

  await user.click(screen.getByRole("button", { name: "歌词" }));
  expect(container.querySelector(".feature-drawer")).toBeInTheDocument();
  expect(container.querySelector(".modern-grid")).toHaveAttribute("data-inspector", "open");

  // Clicking the same icon collapses it again.
  await user.click(screen.getByRole("button", { name: "歌词" }));
  expect(container.querySelector(".feature-drawer")).not.toBeInTheDocument();
});

it("hides and restores the playlist column", async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "播放列表" }));
  expect(screen.queryByRole("region", { name: "当前播放列表" })).not.toBeInTheDocument();
  expect(container.querySelector(".modern-grid")).toHaveAttribute("data-library", "closed");

  await user.click(screen.getByRole("button", { name: "播放列表" }));
  expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();
});

it("switches built-in layout skins in browser mode", async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  const windowActions = screen.getByRole("navigation", { name: "窗口操作" });
  await user.click(within(windowActions).getByRole("button", { name: "皮肤" }));
  expect(screen.getByRole("heading", { name: "皮肤库" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "应用 午夜霓虹" }));

  expect(container.querySelector(".skin-layout--aurora-glass")).not.toBeInTheDocument();
  expect(container.querySelector(".skin-layout--midnight-neon")).toBeInTheDocument();
});
