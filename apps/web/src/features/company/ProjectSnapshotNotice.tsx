import "./project-snapshot-notice.css";

import type { FunctionReturnType } from "convex/server";

import type { api } from "../../../../../convex/_generated/api";

export type ProjectSnapshotState = NonNullable<
  FunctionReturnType<typeof api.projects.getSnapshotState>
>;

type ProjectSnapshotNoticeProps = {
  state: ProjectSnapshotState | null | undefined;
};

const phaseLabels: ReadonlyMap<string, string> = new Map([
  ["prepare", "Preparing the snapshot"],
  ["capture", "Capturing Project context"],
  ["verify", "Verifying the snapshot"],
  ["cleanup", "Finishing snapshot cleanup"],
]);

function getPhaseLabel(phase: string) {
  return phaseLabels.get(phase) ?? "Preparing the snapshot";
}

export function ProjectSnapshotNotice({ state }: ProjectSnapshotNoticeProps) {
  if (state === undefined) {
    return (
      <section aria-busy="true" className="company-snapshot-notice is-loading">
        <strong>Checking Project snapshot status…</strong>
      </section>
    );
  }
  if (state === null) return null;

  const isFailed = state.status === "failed";
  return (
    <section
      aria-live="polite"
      className={
        isFailed
          ? "company-snapshot-notice is-failed"
          : "company-snapshot-notice is-capturing"
      }
      role={isFailed ? "alert" : "status"}
    >
      <div>
        <strong>
          {isFailed
            ? "Project snapshot preparation needs attention"
            : "Project snapshot preparation in progress"}
        </strong>
        <p>
          {isFailed
            ? "Some Project history may remain read-only until the snapshot is retried or canceled."
            : `${getPhaseLabel(state.phase)} · ${state.stagedCount} item${state.stagedCount === 1 ? "" : "s"} staged.`}
        </p>
      </div>
      {state.canManageCapture ? (
        <span className="company-snapshot-notice-owner">Company admin controls available below.</span>
      ) : null}
    </section>
  );
}
