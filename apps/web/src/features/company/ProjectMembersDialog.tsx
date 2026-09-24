import { useMemo, useState } from "react";
import { Search, ShieldCheck, UsersRound } from "lucide-react";

import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";

type ProjectMember = {
  membership: {
    _id: Id<"projectMembers">;
    role: string;
    status?: string;
  };
  user: {
    _id: Id<"users">;
    displayName: string;
  } | null;
};

type ProjectMembersDialogProps = {
  members: Array<ProjectMember>;
  onManageAccess: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectName: string;
};

export function ProjectMembersDialog({ members, onManageAccess, onOpenChange, open, projectName }: ProjectMembersDialogProps) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<Id<"projectMembers"> | null>(null);
  const visibleMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return members;
    return members.filter(({ user }) => user?.displayName.toLocaleLowerCase().includes(normalizedQuery));
  }, [members, query]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery("");
      setExpandedId(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="track-dialog track-members-dialog project-members-dialog">
        <DialogHeader>
          <DialogTitle><UsersRound aria-hidden="true" size={17} /> Project members</DialogTitle>
          <DialogDescription>People with access to {projectName}. Search members or open a row for role and access details.</DialogDescription>
        </DialogHeader>
        <div className="track-members-search">
          <Search aria-hidden="true" size={14} />
          <Input aria-label="Search project members" autoComplete="off" onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search members…" value={query} />
        </div>
        <div aria-live="polite" className="track-members-summary">
          <span>{visibleMembers.length} {visibleMembers.length === 1 ? "member" : "members"}</span>
          <span>{query ? `Matching “${query}”` : "Project access stays permission-aware"}</span>
        </div>
        <ul aria-label="Project members" className="track-members-list">
          {visibleMembers.map(({ membership, user }) => {
            const expanded = expandedId === membership._id;
            return (
              <li className={expanded ? "is-expanded" : ""} key={membership._id}>
                <div className="track-member-row">
                  <span aria-hidden="true" className="track-member-avatar project-member-avatar">{user?.displayName.slice(0, 2).toUpperCase() ?? "?"}</span>
                  <span className="track-member-copy"><strong>{user?.displayName ?? "Removed member"}</strong><small>{membership.status === "active" ? "Active project access" : membership.status ?? "Unknown access"}</small></span>
                  <span className="track-member-role">{membership.role}</span>
                  <Button aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} details for ${user?.displayName ?? "member"}`} className="track-member-action" onClick={() => setExpandedId(expanded ? null : membership._id)} size="sm" variant="ghost">
                    <ShieldCheck aria-hidden="true" size={13} />{expanded ? "Hide" : "Details"}
                  </Button>
                </div>
                {expanded ? <div className="track-member-details"><dl><div><dt>Project role</dt><dd>{membership.role}</dd></div><div><dt>Access status</dt><dd>{membership.status ?? "Unknown"}</dd></div></dl></div> : null}
              </li>
            );
          })}
        </ul>
        {!visibleMembers.length ? <p className="track-members-empty" role="status">No members match this search.</p> : null}
        <DialogFooter>
          <Button className="track-button" onClick={() => handleOpenChange(false)} type="button" variant="outline">Close</Button>
          <Button className="track-button track-button-primary" onClick={() => { handleOpenChange(false); onManageAccess(); }} type="button">Manage access</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
