import { expect, fn, userEvent, within } from "storybook/test";
import preview from "../../../../.storybook/preview";
import { DialogController } from "@/src/components/design-system/DialogController/DialogController";
import { SessionViewActionDialog } from "./SessionViewActionDialog";

const meta = preview.meta({
  component: SessionViewActionDialog,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <DialogController<null>
        initialState={() => null}
        renderDialog={() => <Story />}
      >
        {() => null}
      </DialogController>
    ),
  ],
  args: {
    view: { id: "saved", name: "Generations" },
    action: "duplicate" as const,
    canEdit: true,
    isPending: false,
    error: undefined,
    onSubmit:
      fn<(name: string) => Promise<void>>().mockResolvedValue(undefined),
  },
});
export default meta;

export const Duplicate = meta.story({
  name: "(Test) Duplicate",
  play: async ({ args }) => {
    const body = within(document.body);
    const input = body.getByRole("textbox", { name: "View name" });
    await expect(input).toHaveValue("Generations (copy)");
    await userEvent.clear(input);
    await expect(
      body.getByRole("button", { name: "Save view" }),
    ).toBeDisabled();
    await userEvent.type(input, "  New view  ");
    await userEvent.click(body.getByRole("button", { name: "Save view" }));
    await expect(args.onSubmit).toHaveBeenCalledWith("New view");
  },
});
export const Delete = meta.story({
  name: "(Test) Delete",
  args: { action: "delete" },
  play: async ({ args }) => {
    const body = within(document.body);
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(body.queryByRole("textbox")).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "Delete view" }));
    await expect(args.onSubmit).toHaveBeenCalledWith("Generations");
  },
});
export const ProtectedMessages = meta.story({
  name: "(Test) Protected Messages",
  args: { action: "delete", view: { id: "messages", name: "Messages" } },
  play: async () => {
    await expect(
      within(document.body).getByRole("button", { name: "Delete view" }),
    ).toBeDisabled();
  },
});
export const DuplicateMessages = meta.story({
  args: { view: { id: "messages", name: "Messages" } },
});
export const ReadOnly = meta.story({
  name: "(Test) Read only",
  args: { canEdit: false },
  play: async () => {
    await expect(
      within(document.body).getByRole("button", { name: "Save view" }),
    ).toBeDisabled();
  },
});
export const Pending = meta.story({ args: { isPending: true } });
export const Error = meta.story({
  args: { error: "Unable to save view. Try again." },
});
