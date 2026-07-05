import { render, screen, within } from "@testing-library/react";
import App from "./App";

it("renders the fixed workbench landmarks", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "悠悠乐听" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "当前播放" })).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "功能面板" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "播放动态可视化" })).toBeInTheDocument();

  const controls = screen.getByRole("region", { name: "播放控制" });
  expect(within(controls).getByRole("button", { name: "播放" })).toBeInTheDocument();
  expect(within(controls).getByRole("slider", { name: "播放进度" })).toBeInTheDocument();
});
