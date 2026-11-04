import { type ComponentProps } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/src/utils/api";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { SessionManageViewsDialog } from "./SessionManageViewsDialog";

export function ConnectedSessionManageViewsDialog({
  projectId,
  onViewDeleted,
  ...props
}: Pick<
  ComponentProps<typeof SessionManageViewsDialog>,
  | "unpinnedViewIds"
  | "viewOrder"
  | "onReorder"
  | "onPin"
  | "onUnpin"
  | "onEditView"
> & {
  projectId: string;
  onViewDeleted: (id: string) => void;
}) {
  const utils = api.useUtils();
  const session = useSession();
  const views = api.sessionViews.list.useQuery({
    projectId,
  });
  const canEdit = useHasProjectAccess({
    projectId,
    scope: "TableViewPresets:CUD",
  });
  const deleteView = api.sessionViews.delete.useMutation({
    onSuccess: (_, input) => {
      utils.sessionViews.list.invalidate({ projectId });
      utils.sessionViews.preferences.invalidate({ projectId });
      onViewDeleted(input.id);
    },
  });
  return (
    <SessionManageViewsDialog
      {...props}
      views={views.data ?? []}
      currentUserId={session.data?.user?.id}
      canEdit={canEdit}
      isLoading={views.isLoading}
      error={views.error?.message}
      isDeleting={deleteView.isPending}
      deleteError={deleteView.error?.message}
      onDelete={async (id) => {
        const view = views.data?.find((view) => view.id === id);
        if (!canEdit || !view || view.createdBy !== session.data?.user?.id)
          return;
        deleteView.reset();
        await deleteView.mutateAsync({ projectId, id });
      }}
    />
  );
}
