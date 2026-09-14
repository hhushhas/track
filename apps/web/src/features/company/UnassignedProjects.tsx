import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowUpRight, FolderKanban } from "lucide-react";

import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export function UnassignedProjects({ userId }: { userId: Id<"users"> }) {
  const projects = useQuery(api.projects.list, { userId });

  if (projects === undefined) {
    return <p role="status">Loading your existing Projects…</p>;
  }
  if (projects.length === 0) return null;

  return (
    <section className="company-workspace-section">
      <div className="company-section-heading">
        <div>
          <span className="company-section-kicker">Existing work</span>
          <h2>Projects awaiting Company assignment</h2>
          <p>
            Open your existing Projects here. Their access stays unchanged until
            Company assignment is confirmed.
          </p>
        </div>
        <span className="company-count-badge">{projects.length}</span>
      </div>
      <div className="company-project-gallery large">
        {projects.map(({ project, membership }) => (
          <Link
            className="company-project-card"
            key={project._id}
            params={{ projectId: project._id }}
            to="/workspace/projects/$projectId"
          >
            <span className="company-project-graphic tone-1">
              <FolderKanban aria-hidden="true" size={19} />
            </span>
            <span className="company-project-card-copy">
              <strong>{project.name}</strong>
              <span>Your role: {membership.role} · Company not assigned</span>
            </span>
            <ArrowUpRight
              aria-hidden="true"
              className="company-project-card-arrow"
              size={15}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
