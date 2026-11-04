import { type ComponentProps } from "react";
import { ConnectedSessionListBody } from "@/src/features/sessions/ConnectedSessionListBody";
import { SessionFiltersBanner } from "@/src/features/sessions/SessionFiltersBanner";
import { SessionViewTabs } from "@/src/features/sessions/SessionViewTabs";
import { Button } from "@/src/components/design-system/Button/Button";
import { type FilterState } from "@langfuse/shared";

import { ConnectedModernSessionBodyLegacy } from "@/src/features/sessions/ConnectedModernSessionBodyLegacy";
import { ConnectedModernSessionBodyTimeline } from "@/src/features/sessions/components/ConnectedModernSessionBodyTimeline/ConnectedModernSessionBodyTimeline";
import { ModernSessionFilterControls } from "@/src/features/sessions/ModernSessionFilterControls";
import { ModernSessionHeader } from "@/src/features/sessions/ModernSessionHeader";
import { SessionReviewLeading } from "@/src/features/sessions/SessionReviewLeadingProvider";
import { SessionMetadataJsonPathControl } from "@/src/features/sessions/SessionMetadataJsonPathControl";
import {
  type EventSession,
  type EventSessionTrace,
} from "@/src/features/sessions/sessionDetailPageTypes";

type ModernSessionProps = {
  viewMode: "conversational" | "list";
  viewTabs: ComponentProps<typeof SessionViewTabs>;
  onSaveView?: () => void;
  customization?: NonNullable<
    ComponentProps<typeof ConnectedModernSessionBodyTimeline>["customization"]
  > & {
    onClearFilters: () => void;
  };
  headerDividerTone?: ComponentProps<typeof ModernSessionHeader>["dividerTone"];
  isTimelineEnabled: boolean;
  session: Pick<
    EventSession,
    | "countTraces"
    | "inputUsage"
    | "outputUsage"
    | "totalTokens"
    | "totalCost"
    | "users"
    | "scores"
    | "minTimestamp"
    | "maxTimestamp"
  >;
  tracesState:
    | { type: "loading" }
    | { type: "loaded"; traces: EventSessionTrace[] };
  projectId: string;
  sessionId: string;
  openPeek: (id: string, row: EventSessionTrace) => void;
  traceCommentCounts: Map<string, number> | undefined;
  filterState: FilterState;
  filterMeasurementKey: string;
  viewLabel: string | null;
  showInlineToolCalls: boolean;
  showSystemPrompt: boolean;
  filterControlsProps: Omit<
    ComponentProps<typeof ModernSessionFilterControls>,
    "children"
  >;
  onFilterObservationByName: (
    name: string,
    operator: "any of" | "none of",
  ) => void;
};

export function ModernSession({
  viewMode,
  viewTabs,
  onSaveView,
  customization,
  headerDividerTone,
  isTimelineEnabled,
  session,
  tracesState,
  projectId,
  sessionId,
  openPeek,
  traceCommentCounts,
  filterState,
  filterMeasurementKey,
  viewLabel,
  showInlineToolCalls,
  showSystemPrompt,
  filterControlsProps,
  onFilterObservationByName,
}: ModernSessionProps) {
  const headerTraces =
    tracesState.type === "loaded"
      ? ({ state: "loaded", data: tracesState.traces } as const)
      : ({ state: "loading" } as const);
  const sharedBodyProps = {
    tracesState,
    projectId,
    sessionId,
    sessionMinTimestamp: session.minTimestamp,
    sessionMaxTimestamp: session.maxTimestamp,
    openPeek,
    filterState,
    filterMeasurementKey,
    viewLabel,
    onFilterObservationByName,
  };

  return (
    <>
      <SessionMetadataJsonPathControl
        key={`${projectId}:${sessionId}`}
        projectId={projectId}
        sessionId={sessionId}
        traces={headerTraces}
        filterState={filterState}
      >
        {(metadataJsonPaths) => (
          <SessionReviewLeading>
            <ModernSessionHeader
              dividerTone={headerDividerTone ?? "default"}
              projectId={projectId}
              countTraces={session.countTraces}
              minTimestamp={session.minTimestamp}
              maxTimestamp={session.maxTimestamp}
              tokensIn={session.inputUsage}
              tokensOut={session.outputUsage}
              totalTokens={session.totalTokens}
              totalCost={session.totalCost ?? 0}
              users={session.users ?? []}
              metadataJsonPaths={metadataJsonPaths}
              scores={session.scores}
            />
          </SessionReviewLeading>
        )}
      </SessionMetadataJsonPathControl>
      <SessionViewTabs {...viewTabs} />
      {viewTabs.value === "" ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <h2 className="text-lg font-bold">
            {viewTabs.savedViews.length > 0
              ? "Choose a view"
              : "No pinned views"}
          </h2>
          <p className="text-muted-foreground text-sm">
            Pin Messages or a saved view to explore this session, or create a
            custom view.
          </p>
          <Button
            text="Manage views"
            variant="outline"
            onClick={viewTabs.onManageViews}
          />
        </div>
      ) : (
        <>
          {customization &&
            (customization.activeFilterCount > 0 ||
              viewTabs.value !== "messages") && (
              <SessionFiltersBanner
                onEdit={customization.onCustomizeView}
                onClear={customization.onClearFilters}
                onSave={onSaveView}
                hasFilters={customization.activeFilterCount > 0}
              />
            )}
          {isTimelineEnabled && viewMode === "list" && (
            <ConnectedSessionListBody
              {...sharedBodyProps}
              traceCommentCounts={traceCommentCounts}
              filterState={filterState.filter(
                (filter) => filter.column !== "traceName",
              )}
              viewLabel={null}
              showInlineToolCalls={true}
              showSystemPrompt={true}
              onCustomizeView={customization?.onCustomizeView}
              activeFilterCount={
                customization?.activeFilterCount ?? filterState.length
              }
            />
          )}
          {isTimelineEnabled && viewMode === "conversational" && (
            <ConnectedModernSessionBodyTimeline
              customization={customization}
              tracesState={tracesState}
              projectId={projectId}
              sessionId={sessionId}
              openPeek={openPeek}
              filterState={filterState}
            />
          )}
          {!isTimelineEnabled && (
            <ModernSessionFilterControls {...filterControlsProps}>
              {(sidebarFilterControls) => (
                <ConnectedModernSessionBodyLegacy
                  {...sharedBodyProps}
                  traceCommentCounts={traceCommentCounts}
                  showInlineToolCalls={showInlineToolCalls}
                  showSystemPrompt={showSystemPrompt}
                  sidebarFilterControls={sidebarFilterControls}
                />
              )}
            </ModernSessionFilterControls>
          )}
        </>
      )}
    </>
  );
}
