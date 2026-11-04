import { type ComponentProps, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  ArrowUp,
  ArrowDown,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "@langfuse/icons";
import { type RouterOutputs } from "@/src/utils/api";
import { IconButton } from "@/src/components/design-system/IconButton/IconButton";
import { Tooltip } from "@/src/components/design-system/Tooltip/Tooltip";
import { createUserTableColumn } from "@/src/components/design-system/table/columns/createUserTableColumn";
import { Tabs } from "@/src/components/design-system/Tabs/Tabs";
import {
  Table,
  type AsyncTableData,
} from "@/src/components/design-system/table/Table";
import { Dialog } from "@/src/components/design-system/Dialog/Dialog";
import { ConfirmationDialogController } from "@/src/components/design-system/ConfirmationDialogController/ConfirmationDialogController";

type SessionViewRow = ComponentProps<
  typeof SessionManageViewsList
>["views"][number] & {
  controls: Pick<
    ComponentProps<typeof SessionManageViewsList>,
    | "views"
    | "currentUserId"
    | "unpinnedViewIds"
    | "canEdit"
    | "onPin"
    | "onUnpin"
    | "onEdit"
    | "onDelete"
    | "onMove"
  >;
};

const columns: ColumnDef<SessionViewRow>[] = [
  {
    id: "pinned",
    header: "",
    enableResizing: false,
    size: 40,
    cell: ({ row }) => {
      const view = row.original;
      const { unpinnedViewIds, onUnpin, onPin } = view.controls;
      const isPinned = !unpinnedViewIds.includes(view.id);
      const pinLabel = `${isPinned ? "Unpin" : "Pin"} ${view.name}`;
      return (
        <Tooltip label={pinLabel}>
          {({ getTriggerProps }) => (
            <IconButton
              icon={isPinned ? PinOff : Pin}
              label={pinLabel}
              {...getTriggerProps({
                onClick: () => (isPinned ? onUnpin(view.id) : onPin(view.id)),
              })}
            />
          )}
        </Tooltip>
      );
    },
  },
  {
    accessorKey: "name",
    header: "Name",
    enableResizing: false,
    cell: ({ row }) => (
      <span className="block truncate" title={row.original.name}>
        {row.original.name}
      </span>
    ),
  },
  createUserTableColumn<SessionViewRow>({
    id: "createdBy",
    accessorFn: (view) => view.createdByUser,
    header: "Created by",
    enableResizing: false,
    variant: "avatar",
    emptyValue: "Unknown user",
    nullValue: "Built-in",
    getUser: (user, { row }) => {
      if (row.original.id === "messages") return undefined;
      return { type: "user", user: user ?? {} };
    },
  }),
  {
    id: "actions",
    header: "",
    headerClassName: "text-right",
    cellClassName: "text-right",
    enableResizing: false,
    size: 160,
    cell: ({ row }) => {
      const view = row.original;
      const {
        views,
        unpinnedViewIds,
        canEdit,
        currentUserId,
        onMove,
        onEdit,
        onDelete,
      } = view.controls;
      const reorderableViews = views.filter(
        (candidate) =>
          candidate.id !== "messages" &&
          !unpinnedViewIds.includes(candidate.id),
      );
      const index = reorderableViews.findIndex(
        (candidate) => candidate.id === view.id,
      );
      return (
        <div className="flex w-full items-center justify-end gap-2">
          <IconButton
            icon={ArrowUp}
            label={`Move ${view.name} up`}
            disabled={index <= 0}
            onClick={() => onMove(view.id, "up")}
          />
          <IconButton
            icon={ArrowDown}
            label={`Move ${view.name} down`}
            disabled={index < 0 || index === reorderableViews.length - 1}
            onClick={() => onMove(view.id, "down")}
          />
          {(canEdit || view.id === "messages") && (
            <>
              <IconButton
                icon={Pencil}
                label={`Edit ${view.name}`}
                disabled={
                  view.id === "messages" || view.createdBy !== currentUserId
                }
                onClick={() => onEdit(view.id)}
              />
              <IconButton
                icon={Trash2}
                label={`Delete ${view.name}`}
                disabled={
                  view.id === "messages" || view.createdBy !== currentUserId
                }
                onClick={() => onDelete(view.id)}
              />
            </>
          )}
        </div>
      );
    },
  },
];

function SessionManageViewsList({
  views,
  currentUserId,
  unpinnedViewIds,
  canEdit,
  isLoading,
  error,
  onPin,
  onUnpin,
  onEdit,
  onDelete,
  onMove,
}: {
  views: (Pick<RouterOutputs["sessionViews"]["list"][number], "id" | "name"> &
    Partial<
      Pick<
        RouterOutputs["sessionViews"]["list"][number],
        "createdBy" | "createdByUser"
      >
    >)[];
  currentUserId: string | undefined;
  unpinnedViewIds: string[];
  canEdit: boolean;
  isLoading: boolean;
  error: string | undefined;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}) {
  const [tab, setTab] = useState("all");
  const filteredViews = views
    .filter((view) => {
      if (tab === "all") return true;
      if (view.id === "messages" || !currentUserId) return false;
      if (tab === "mine") return view.createdBy === currentUserId;
      return view.createdBy !== currentUserId;
    })
    .sort(
      (left, right) =>
        Number(unpinnedViewIds.includes(left.id)) -
        Number(unpinnedViewIds.includes(right.id)),
    );
  const rows = filteredViews.map((view) => ({
    ...view,
    controls: {
      views,
      currentUserId,
      unpinnedViewIds,
      canEdit,
      onPin,
      onUnpin,
      onEdit,
      onDelete,
      onMove,
    },
  }));
  const data = ((): AsyncTableData<SessionViewRow[]> => {
    if (isLoading) return { status: "loading" };
    if (error) return { status: "error", error };
    return { status: "success", data: rows };
  })();
  const noResultsMessage = (() => {
    if (tab === "mine") return "You haven’t created any views yet.";
    if (tab === "others") return "No views from other people yet.";
    return "No saved views yet.";
  })();
  return (
    <div className="flex flex-col gap-2">
      <Tabs value={tab} onValueChange={setTab}>
        <Tabs.List variant="inset" size="md">
          <Tabs.Trigger value="all" label="All views" />
          <Tabs.Trigger value="mine" label="My views" />
          <Tabs.Trigger value="others" label="Others’ views" />
        </Tabs.List>
      </Tabs>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-md border">
        <Table
          tableName="Session views"
          data={data}
          noResultsMessage={noResultsMessage}
          columns={columns}
          topBorder={false}
        />
      </div>
    </div>
  );
}

export function SessionManageViewsDialog({
  views,
  currentUserId,
  canEdit,
  isLoading,
  error,
  isDeleting,
  deleteError,
  onDelete,
  unpinnedViewIds,
  viewOrder,
  onReorder,
  onPin,
  onUnpin,
  onEditView,
}: {
  views: ComponentProps<typeof SessionManageViewsList>["views"];
  currentUserId: string | undefined;
  canEdit: boolean;
  isLoading: boolean;
  error: string | undefined;
  isDeleting: boolean;
  deleteError: string | undefined;
  onDelete: (id: string) => Promise<void>;
  unpinnedViewIds: string[];
  viewOrder: string[];
  onReorder: (ids: string[]) => void;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
  onEditView: (id: string) => void;
}) {
  const customViews = [...views].sort((left, right) => {
    const leftIndex = viewOrder.indexOf(left.id);
    const rightIndex = viewOrder.indexOf(right.id);
    return (
      (leftIndex < 0 ? Infinity : leftIndex) -
      (rightIndex < 0 ? Infinity : rightIndex)
    );
  });
  return (
    <Dialog title="Manage views" closeLabel="Done" size="md">
      <Dialog.Body padding="horizontal">
        <ConfirmationDialogController<(typeof views)[number]>
          title={(view) => `Delete ${view.name}?`}
          text="This permanently deletes the saved view for everyone in this project."
          confirmLabel="Delete view"
          variant="destructive"
          loading={isDeleting}
          error={deleteError}
          onConfirm={async (view) => {
            await onDelete(view.id);
          }}
        >
          {({ openDialog: openDelete }) => (
            <SessionManageViewsList
              currentUserId={currentUserId}
              views={[{ id: "messages", name: "Messages" }, ...customViews]}
              unpinnedViewIds={unpinnedViewIds}
              canEdit={canEdit}
              isLoading={isLoading}
              error={error}
              onPin={onPin}
              onUnpin={onUnpin}
              onMove={(id, direction) => {
                const ids = customViews
                  .filter((view) => !unpinnedViewIds.includes(view.id))
                  .map((view) => view.id);
                const index = ids.indexOf(id);
                const target = direction === "up" ? index - 1 : index + 1;
                if (index < 0 || target < 0 || target >= ids.length) return;
                ids.splice(index, 1);
                ids.splice(target, 0, id);
                onReorder([
                  ...ids,
                  ...customViews
                    .filter((view) => unpinnedViewIds.includes(view.id))
                    .map((view) => view.id),
                ]);
              }}
              onEdit={(id) => {
                const view = customViews.find((view) => view.id === id);
                if (!view || !canEdit || view.createdBy !== currentUserId)
                  return;
                onEditView(id);
              }}
              onDelete={(id) => {
                const view = customViews.find((view) => view.id === id);
                if (!view || !canEdit || view.createdBy !== currentUserId)
                  return;
                openDelete(view);
              }}
            />
          )}
        </ConfirmationDialogController>
      </Dialog.Body>
    </Dialog>
  );
}
