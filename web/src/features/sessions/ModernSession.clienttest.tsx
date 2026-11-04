import {
  fireEvent,
  render as renderWithOptions,
  screen,
} from "@testing-library/react";
import { type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModernSession } from "@/src/features/sessions/ModernSession";
import { SessionSidebar } from "@/src/features/sessions/components/SessionSidebar/SessionSidebar";
import { LayerProvider } from "@/src/context/LayerContext/LayerContext";

const render = (ui: ReactNode) =>
  renderWithOptions(ui, { wrapper: LayerProvider });

vi.mock("@/src/features/sessions/ConnectedModernSessionBodyLegacy", () => ({
  ConnectedModernSessionBodyLegacy: () => <div>Legacy body</div>,
}));

vi.mock("@/src/features/sessions/ConnectedSessionListBody", () => ({
  ConnectedSessionListBody: () => <div>List body</div>,
}));

vi.mock(
  "@/src/features/sessions/components/ConnectedModernSessionBodyTimeline/ConnectedModernSessionBodyTimeline",
  () => ({
    ConnectedModernSessionBodyTimeline: () => <div>Timeline body</div>,
  }),
);

vi.mock("@/src/features/sessions/ModernSessionHeader", () => ({
  ModernSessionHeader: () => <div>Modern session header</div>,
}));

vi.mock("@/src/features/sessions/ModernSessionFilterControls", () => ({
  ModernSessionFilterControls: ({
    children,
  }: {
    children: (controls: never) => ReactNode;
  }) => <div data-testid="legacy-filter-controls">{children({} as never)}</div>,
}));

vi.mock("@/src/features/sessions/SessionMetadataJsonPathControl", () => ({
  SessionMetadataJsonPathControl: ({
    children,
  }: {
    children: (state: {
      paths: readonly string[];
      source: { state: "idle" };
      onEditorOpenChange: (open: boolean) => void;
      onSave: (path: string) => void;
      onRemove: (path: string) => void;
    }) => ReactNode;
  }) =>
    children({
      paths: [],
      source: { state: "idle" },
      onEditorOpenChange: vi.fn(),
      onSave: vi.fn(),
      onRemove: vi.fn(),
    }),
}));

const defaultProps = {
  viewMode: "conversational",
  viewTabs: {
    value: "messages",
    hasUnsavedView: false,
    isMessagesPinned: true,
    savedViews: [],
    onManageViews: vi.fn(),
    onUnpin: vi.fn(),
    onRemoveUnsaved: vi.fn(),
    onValueChange: vi.fn(),
    onCreate: vi.fn(),
    canManageViews: true,
    onViewAction: vi.fn(),
  },
  isTimelineEnabled: false,
  session: {
    countTraces: 0,
    inputUsage: 0,
    outputUsage: 0,
    totalTokens: 0,
    totalCost: 0,
    users: [],
    scores: [],
    minTimestamp: new Date("2026-01-01T00:00:00.000Z"),
    maxTimestamp: new Date("2026-01-01T00:00:01.000Z"),
  },
  tracesState: { type: "loaded", traces: [] } as const,
  projectId: "project-id",
  sessionId: "session-id",
  openPeek: vi.fn(),
  traceCommentCounts: undefined,
  filterState: [],
  filterMeasurementKey: "filters",
  viewLabel: null,
  showInlineToolCalls: false,
  showSystemPrompt: false,
  filterControlsProps: {
    projectId: "project-id",
    filterState: [],
    filterColumns: [],
    filterColumnsWithCustomSelect: [],
    onChange: vi.fn(),
    viewControllers: {
      selectedViewId: null,
      appliedViewId: null,
      viewUpdateTarget: null,
      filterEditorResetKey: 0,
      handleUserStateChange: vi.fn(),
      handleSetViewId: vi.fn(),
      applyViewState: vi.fn(),
    },
    currentViewState: {
      orderBy: null,
      filters: [],
      columnOrder: [],
      columnVisibility: {},
      searchQuery: "",
    },
  },
  onFilterObservationByName: vi.fn(),
} satisfies ComponentProps<typeof ModernSession>;

describe("ModernSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  it("keeps sidebar search without the redundant customization icon", () => {
    render(
      <SessionSidebar
        label="Session observations"
        search={{
          search: "",
          onSearchChange: vi.fn(),
          customization: { activeFilterCount: 1, onCustomizeView: vi.fn() },
        }}
      />,
    );

    expect(
      screen.getByRole("textbox", { name: "Search session" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Customize view" }),
    ).not.toBeInTheDocument();
  });
  it("saves an unsaved view from its menu", async () => {
    const onSaveUnsaved = vi.fn();
    render(
      <ModernSession
        {...defaultProps}
        viewTabs={{
          ...defaultProps.viewTabs,
          hasUnsavedView: true,
          onSaveUnsaved,
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Unsaved view options" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Save" }));
    expect(onSaveUnsaved).toHaveBeenCalledOnce();
    expect(defaultProps.viewTabs.onRemoveUnsaved).not.toHaveBeenCalled();
  });

  it("hides draft saving without permission", async () => {
    render(
      <ModernSession
        {...defaultProps}
        viewTabs={{
          ...defaultProps.viewTabs,
          hasUnsavedView: true,
          canManageViews: false,
          onSaveUnsaved: vi.fn(),
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Unsaved view options" }),
    );
    await screen.findByRole("menuitem", { name: "Discard" });
    expect(
      screen.queryByRole("menuitem", { name: "Save" }),
    ).not.toBeInTheDocument();
  });

  it("removes an unsaved view rather than unpinning it", async () => {
    render(
      <ModernSession
        {...defaultProps}
        viewTabs={{
          ...defaultProps.viewTabs,
          value: "unsaved",
          hasUnsavedView: true,
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Unsaved view options" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Discard" }));

    expect(defaultProps.viewTabs.onRemoveUnsaved).toHaveBeenCalledOnce();
    expect(defaultProps.viewTabs.onUnpin).not.toHaveBeenCalled();
    expect(defaultProps.viewTabs.onValueChange).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Unpin Unsaved view" }),
    ).not.toBeInTheDocument();
  });
  it("unpins a saved view without selecting its tab", async () => {
    render(
      <ModernSession
        {...defaultProps}
        viewTabs={{
          ...defaultProps.viewTabs,
          savedViews: [{ id: "saved-view", name: "Generations" }],
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Generations options" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Unpin" }));

    expect(defaultProps.viewTabs.onUnpin).toHaveBeenCalledWith("saved-view");
    expect(defaultProps.viewTabs.onValueChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Messages options" }),
    ).toBeInTheDocument();
  });

  it("allows unpinning Messages", async () => {
    render(<ModernSession {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Messages options" }));
    expect(
      screen.queryByRole("menuitem", { name: "Delete" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Rename" }),
    ).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Unpin" }));
    expect(defaultProps.viewTabs.onUnpin).toHaveBeenCalledWith("messages");
  });

  it.each(["duplicate", "delete", "edit"] as const)(
    "offers %s from a saved tab menu",
    async (action) => {
      render(
        <ModernSession
          {...defaultProps}
          viewTabs={{
            ...defaultProps.viewTabs,
            savedViews: [{ id: "saved", name: "Generations" }],
          }}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Generations options" }),
      );
      fireEvent.click(
        await screen.findByRole("menuitem", {
          name: new RegExp(`^${action}$`, "i"),
        }),
      );
      expect(defaultProps.viewTabs.onViewAction).toHaveBeenCalledWith(
        "saved",
        action,
      );
      expect(defaultProps.viewTabs.onValueChange).not.toHaveBeenCalled();
    },
  );

  it("restricts mutation actions to users with permission", async () => {
    render(
      <ModernSession
        {...defaultProps}
        viewTabs={{
          ...defaultProps.viewTabs,
          canManageViews: false,
          savedViews: [{ id: "saved", name: "Generations" }],
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Generations options" }),
    );
    await screen.findByRole("menuitem", { name: "Unpin" });
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  });

  it("shows a recovery action when every view is unpinned", () => {
    render(
      <ModernSession
        {...defaultProps}
        viewTabs={{
          ...defaultProps.viewTabs,
          value: "",
          isMessagesPinned: false,
        }}
      />,
    );
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No pinned views" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Manage views" })[1]!,
    );
    expect(defaultProps.viewTabs.onManageViews).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("always offers the manage views action, including without saved views", () => {
    render(<ModernSession {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Manage views" }));
    expect(defaultProps.viewTabs.onManageViews).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Pin saved view" }),
    ).not.toBeInTheDocument();
  });

  it("always displays Messages and an icon-only create action", () => {
    render(<ModernSession {...defaultProps} />);

    expect(screen.getByRole("tab", { name: "Messages" })).toHaveAttribute(
      "data-state",
      "active",
    );
    const create = screen.getByRole("button", { name: "Create custom view" });
    expect(create.textContent).toBe("");
    fireEvent.click(create);
    expect(defaultProps.viewTabs.onCreate).toHaveBeenCalled();
  });

  it("shows an unsaved tab and save action even without filters", () => {
    const onSave = vi.fn();
    render(
      <ModernSession
        {...defaultProps}
        isTimelineEnabled
        viewTabs={{
          ...defaultProps.viewTabs,
          value: "unsaved",
          hasUnsavedView: true,
        }}
        customization={{
          activeFilterCount: 0,
          onCustomizeView: vi.fn(),
          onClearFilters: vi.fn(),
        }}
        onSaveView={onSave}
      />,
    );
    expect(screen.getByRole("tab", { name: "Unsaved view" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(
      screen.queryByText(
        "Filters are active. Some session data may be hidden.",
      ),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    expect(onSave).toHaveBeenCalled();
  });

  it("renders the list body with the shared header when selected", () => {
    render(
      <ModernSession {...defaultProps} isTimelineEnabled viewMode="list" />,
    );

    expect(screen.getByText("Modern session header")).toBeInTheDocument();
    expect(screen.getByText("List body")).toBeInTheDocument();
    expect(screen.queryByText("Timeline body")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy body")).not.toBeInTheDocument();
  });

  it("renders the shared header and legacy connected body by default", () => {
    render(<ModernSession {...defaultProps} />);

    expect(screen.getByText("Modern session header")).toBeInTheDocument();
    expect(screen.getByText("Legacy body")).toBeInTheDocument();
    expect(screen.getByTestId("legacy-filter-controls")).toBeInTheDocument();
    expect(screen.queryByText("Timeline body")).not.toBeInTheDocument();
  });

  it("renders the timeline whenever enabled, including public access", () => {
    render(<ModernSession {...defaultProps} isTimelineEnabled />);

    expect(screen.getByText("Modern session header")).toBeInTheDocument();
    expect(screen.getByText("Timeline body")).toBeInTheDocument();
    expect(
      screen.queryByTestId("legacy-filter-controls"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy body")).not.toBeInTheDocument();
  });
});
