import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppErrorBanner } from "./AppErrorBanner";

describe("AppErrorBanner", () => {
  it("renders mapped app error as alert", () => {
    render(<AppErrorBanner error={{ code: "file_missing", message: "a.mp3" }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("文件丢失：a.mp3");
  });

  it("renders preformatted string errors", () => {
    render(<AppErrorBanner error="导入失败" />);

    expect(screen.getByRole("alert")).toHaveTextContent("导入失败");
  });
});
