import { useId, useState } from "react";
import { type TableViewPresetDomain } from "@langfuse/shared";
import { Dialog } from "@/src/components/design-system/Dialog/Dialog";
import { Form } from "@/src/components/design-system/Form/Form";
import { Input } from "@/src/components/design-system/Input/Input";

export function SessionViewActionDialog({
  view,
  action,
  canEdit,
  isPending,
  error,
  onSubmit,
}: {
  view: Pick<TableViewPresetDomain, "id" | "name">;
  action: "delete" | "duplicate";
  canEdit: boolean;
  isPending: boolean;
  error: string | undefined;
  onSubmit: (name: string) => Promise<void>;
}) {
  const formId = useId();
  const [name, setName] = useState(
    action === "duplicate" ? `${view.name} (copy)` : view.name,
  );
  const isProtected = view.id === "messages" && action === "delete";
  return (
    <Dialog
      title={action === "delete" ? `Delete ${view.name}?` : "Duplicate view"}
      actions={[
        {
          label: action === "delete" ? "Delete view" : "Save view",
          variant: action === "delete" ? "destructive" : "default",
          type: "submit",
          form: formId,
          loading: isPending,
          disabled: !canEdit || isProtected || !name.trim(),
        },
      ]}
    >
      <Dialog.Body padding="horizontal">
        <form
          id={formId}
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!canEdit || isProtected || isPending || !name.trim()) return;
            await onSubmit(name.trim());
          }}
        >
          {action === "delete" ? (
            <p className="text-sm">
              This permanently deletes the saved view for everyone in this
              project.
            </p>
          ) : (
            <Form.Field label="View name">
              {({ id }) => (
                <Input
                  id={id}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                />
              )}
            </Form.Field>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </form>
      </Dialog.Body>
    </Dialog>
  );
}
