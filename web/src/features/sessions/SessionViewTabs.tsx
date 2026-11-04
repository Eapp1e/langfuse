import { Tabs } from "@/src/components/design-system/Tabs/Tabs";
import { TabBar } from "@/src/components/design-system/TabBar/TabBar";
import { type ComponentProps } from "react";
import { Copy, PinOff, Pencil, Save, Trash2 } from "@langfuse/icons";
import { type ConnectedSessionViewActionDialog } from "@/src/features/sessions/SessionViewActionDialog/ConnectedSessionViewActionDialog";

export function SessionViewTabs({
  value,
  hasUnsavedView,
  isMessagesPinned,
  savedViews,
  onManageViews,
  onUnpin,
  onRemoveUnsaved,
  onSaveUnsaved,
  onValueChange,
  onCreate,
  canManageViews,
  onViewAction,
}: {
  value: string;
  hasUnsavedView: boolean;
  isMessagesPinned: boolean;
  savedViews: { id: string; name: string; canEdit?: boolean }[];
  onManageViews: () => void;
  onUnpin: (id: string) => void;
  onRemoveUnsaved: () => void;
  onSaveUnsaved?: () => void;
  onValueChange: (value: string) => void;
  onCreate: () => void;
  canManageViews: boolean;
  onViewAction: (
    id: string,
    action: ComponentProps<typeof ConnectedSessionViewActionDialog>["action"],
  ) => void;
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabBar
        label="Session views"
        tabs={[
          ...(isMessagesPinned
            ? [
                {
                  value: "messages",
                  label: "Messages",
                  menu: {
                    label: "Messages options",
                    items: [
                      {
                        type: "item" as const,
                        id: "unpin",
                        title: "Unpin",
                        icon: PinOff,
                        onClick: () => onUnpin("messages"),
                      },
                      ...(canManageViews
                        ? [
                            {
                              type: "item" as const,
                              id: "duplicate",
                              title: "Duplicate",
                              icon: Copy,
                              onClick: () =>
                                onViewAction("messages", "duplicate"),
                            },
                          ]
                        : []),
                    ],
                  },
                },
              ]
            : []),
          ...savedViews.map((view) => ({
            value: view.id,
            label: view.name,
            menu: {
              label: `${view.name} options`,
              items: [
                {
                  type: "item" as const,
                  id: "unpin",
                  title: "Unpin",
                  icon: PinOff,
                  onClick: () => onUnpin(view.id),
                },
                ...(canManageViews
                  ? [
                      {
                        type: "item" as const,
                        id: "edit",
                        title: "Edit",
                        disabled:
                          view.canEdit === false
                            ? { reason: "Only the creator can edit this view." }
                            : undefined,
                        icon: Pencil,
                        onClick: () => onViewAction(view.id, "edit"),
                      },
                      {
                        type: "item" as const,
                        id: "duplicate",
                        title: "Duplicate",
                        icon: Copy,
                        onClick: () => onViewAction(view.id, "duplicate"),
                      },
                      {
                        type: "item" as const,
                        id: "delete",
                        title: "Delete",
                        disabled:
                          view.canEdit === false
                            ? {
                                reason:
                                  "Only the creator can delete this view.",
                              }
                            : undefined,
                        icon: Trash2,
                        variant: "destructive" as const,
                        onClick: () => onViewAction(view.id, "delete"),
                      },
                    ]
                  : []),
              ],
            },
          })),
          ...(hasUnsavedView
            ? [
                {
                  value: "unsaved",
                  label: "Unsaved view",
                  menu: {
                    label: "Unsaved view options",
                    items: [
                      ...(canManageViews && onSaveUnsaved
                        ? [
                            {
                              type: "item" as const,
                              id: "save",
                              title: "Save",
                              icon: Save,
                              onClick: onSaveUnsaved,
                            },
                          ]
                        : []),
                      {
                        type: "item" as const,
                        id: "discard",
                        title: "Discard",
                        icon: Trash2,
                        variant: "destructive" as const,
                        onClick: onRemoveUnsaved,
                      },
                    ],
                  },
                },
              ]
            : []),
        ]}
        createAction={{ label: "Create custom view", onClick: onCreate }}
        manageAction={{ label: "Manage views", onClick: onManageViews }}
      />
    </Tabs>
  );
}
