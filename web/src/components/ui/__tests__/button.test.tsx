import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("is clickable by default", async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is not clickable when disabled", async () => {
    const onClick = jest.fn();
    render(<Button disabled onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies the primary variant class by default", () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-primary");
  });

  it("applies the outline variant class", () => {
    render(<Button variant="outline">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("border");
  });

  it("applies the destructive variant class", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-destructive");
  });

  it("renders as a child element with asChild", () => {
    render(
      <Button asChild>
        <a href="/test">Link button</a>
      </Button>
    );
    expect(screen.getByRole("link", { name: "Link button" })).toBeInTheDocument();
  });

  it("applies sm size class", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-9");
  });

  it("applies lg size class", () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-12");
  });

  it("accepts a custom className", () => {
    render(<Button className="my-custom">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("my-custom");
  });

  it("keeps the small size at least 44 px tall on a touch screen", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-9", "pointer-coarse:h-11");
  });
});
