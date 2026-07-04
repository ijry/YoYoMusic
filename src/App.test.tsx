import { render, screen } from "@testing-library/react";
import App from "./App";

it("renders the YoYoMusic app title", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "悠悠乐听" })).toBeInTheDocument();
});
