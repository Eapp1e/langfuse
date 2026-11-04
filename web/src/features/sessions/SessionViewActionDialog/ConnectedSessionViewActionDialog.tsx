import { useState } from "react";
import { useSession } from "next-auth/react";
import { api, type RouterOutputs } from "@/src/utils/api";
import { SessionViewActionDialog } from "./SessionViewActionDialog";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { ConnectedSessionCustomizationDialog } from "@/src/features/sessions/SessionCustomizationDialog/ConnectedSessionCustomizationDialog";

export function ConnectedSessionViewActionDialog({
  projectId,
  sessionId,
  isOpen,
  view,
  action,
  onSaved,
  onDeleted,
  onClose,
}: {
  projectId: string;
  sessionId: string;
  isOpen: boolean;
  view: Pick<
    RouterOutputs["sessionViews"]["list"][number],
    "id" | "name" | "filters" | "viewMode" | "unmatchedTraces" | "createdBy"
  >;
  action: "edit" | "delete" | "duplicate";
  onSaved: (view: RouterOutputs["sessionViews"]["create"]["view"]) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(
    action === "duplicate" ? `${view.name} (copy)` : view.name,
  );
  const canEdit = useHasProjectAccess({
    projectId,
    scope: "TableViewPresets:CUD",
  });
  const utils = api.useUtils();
  const session = useSession();
  const createView = api.sessionViews.create.useMutation();
  const updateView = api.sessionViews.update.useMutation();
  const deleteView = api.sessionViews.delete.useMutation();
  const isPending =
    createView.isPending || updateView.isPending || deleteView.isPending;
  const error = createView.error ?? updateView.error ?? deleteView.error;
  const isProtected =
    action !== "duplicate" &&
    (view.id === "messages" || view.createdBy !== session.data?.user?.id);

  if (action === "edit") {
    return (
      <ConnectedSessionCustomizationDialog
        projectId={projectId}
        sessionId={sessionId}
        isOpen={isOpen}
        initialFilters={view.filters}
        initialUnmatchedTraces={view.unmatchedTraces}
        initialViewMode={view.viewMode}
        editing={{
          name,
          onNameChange: setName,
          pending: isPending,
          disabled: !canEdit || isProtected,
          error: error?.message,
        }}
        onApply={async (filters, unmatchedTraces, viewMode) => {
          if (!canEdit || isProtected || isPending || !name.trim()) return;
          try {
            const result = await updateView.mutateAsync({
              projectId,
              id: view.id,
              name: name.trim(),
              filters,
              viewMode,
              unmatchedTraces,
            });
            onSaved(result.view);
            await utils.sessionViews.list.invalidate({ projectId });
            onClose();
          } catch {
            // Keep mutation errors visible so saving can be retried.
          }
        }}
      />
    );
  }

  return (
    <SessionViewActionDialog
      view={view}
      action={action}
      canEdit={canEdit && !isProtected}
      isPending={isPending}
      error={error?.message}
      onSubmit={async (name) => {
        if (!canEdit || isProtected || isPending) return;
        try {
          if (action === "delete") {
            await deleteView.mutateAsync({
              projectId,
              id: view.id,
            });
            onDeleted(view.id);
            utils.sessionViews.preferences.invalidate({ projectId });
          } else {
            const input = {
              projectId,
              name: name.trim(),
              filters: view.filters,
              viewMode: view.viewMode,
              unmatchedTraces: view.unmatchedTraces,
            };
            const result = await createView.mutateAsync(input);
            onSaved(result.view);
          }
          await utils.sessionViews.list.invalidate({ projectId });
          onClose();
        } catch {
          // Mutation errors remain visible in the dialog so the action can be retried.
        }
      }}
    />
  );
}
