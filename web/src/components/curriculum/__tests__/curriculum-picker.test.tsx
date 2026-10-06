/**
 * The "what is this about?" picker. What is tested: it hides itself with no
 * items, shows what is already chosen, only enables Save after a change, sends
 * the chosen ids, and shows the action's error instead of pretending it saved.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockSet = jest.fn();
jest.mock("@/app/actions/curriculum-links", () => ({ setCurriculumLinks: (...a: unknown[]) => mockSet(...a) }));
const mockToast = { error: jest.fn(), success: jest.fn() };
jest.mock("sonner", () => ({ toast: { error: (m: string) => mockToast.error(m), success: (m: string) => mockToast.success(m) } }));

import { CurriculumPicker } from "../curriculum-picker";
import type { CurriculumGroup } from "@/lib/curriculum";

const item = (id: string, title: string) => ({ id, ageGroup: "U13", category: "technical" as const, title, description: null, sortOrder: 0, active: true });
const groups: CurriculumGroup[] = [
  { category: "technical", items: [item("a", "First touch"), item("b", "Crossing")] },
  { category: "tactical", items: [] },
];

beforeEach(() => jest.clearAllMocks());

it("renders nothing when there are no items", () => {
  const { container } = render(<CurriculumPicker linkType="session" linkId="s1" groups={[{ category: "technical", items: [] }]} initialIds={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it("shows items, marks the chosen ones, and keeps Save off until something changes", () => {
  render(<CurriculumPicker linkType="session" linkId="s1" groups={groups} initialIds={["a"]} />);
  expect(screen.getByLabelText("First touch")).toBeChecked();
  expect(screen.getByLabelText("Crossing")).not.toBeChecked();
  expect(screen.queryByText("Tactical")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
});

it("sends exactly the chosen ids", async () => {
  mockSet.mockResolvedValue({ success: true });
  render(<CurriculumPicker linkType="objective" linkId="o1" groups={groups} initialIds={["a"]} />);
  fireEvent.click(screen.getByLabelText("Crossing"));
  fireEvent.click(screen.getByLabelText("First touch"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mockSet).toHaveBeenCalledWith("objective", "o1", ["b"]));
  await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
});

it("shows the error and leaves Save available when the save fails", async () => {
  mockSet.mockResolvedValue({ error: "Curriculum is not set up yet." });
  render(<CurriculumPicker linkType="session" linkId="s1" groups={groups} initialIds={[]} />);
  fireEvent.click(screen.getByLabelText("Crossing"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Curriculum is not set up yet."));
  expect(mockToast.success).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});
