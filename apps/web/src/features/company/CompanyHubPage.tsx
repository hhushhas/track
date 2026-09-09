import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, FolderKanban, MoreHorizontal, Plus, Settings2, Users } from "lucide-react";

import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { NativeSelect, NativeSelectOption } from "#/components/ui/native-select";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "#/components/ui/popover";
import { resolveReleaseConfig, useReleaseConfigProjection } from "#/lib/release-config";
import {
  CreateCompanyForm,
  CompanyProjectForm,
  InviteMemberForm,
  RelationshipForm,
  RelationshipParticipantForm,
  SharedProjectForm,
} from "./CompanyForms";
import { useActingCompany } from "./use-acting-company";
import { resolveCompanyMemberActionCapabilities } from "./company-member-capabilities";
import { MigrationPanel } from "./MigrationPanel";
import { selectTopCompanyProject } from "#/features/workspace/lib/project-classification";

const companyRoleLabels = {
  owner: "Company Owner",
  admin: "Company Admin",
  member: "Company Member",
} as const;

function CompanyActionPopover({
  children,
  description,
  label,
  title,
}: {
  children: ReactNode;
  description: string;
  label: string;
  title: string;
}) {
  return (
    <Popover>
      <PopoverTrigger render={<Button className="company-section-action" variant="outline" />}>
        <Plus aria-hidden="true" size={14} />
        {label}
      </PopoverTrigger>
      <PopoverContent align="end" className="company-action-popover" sideOffset={8}>
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{description}</PopoverDescription>
        </PopoverHeader>
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function CompanyHubPage() {
  const navigate = useNavigate();
  const releaseConfigProjection = useReleaseConfigProjection();
  const flags = resolveReleaseConfig(releaseConfigProjection);
  const currentUser = useQuery(api.auth.getCurrentUser);
  const companies = useQuery(
    api.companies.listMine,
    flags.companyModel ? {} : "skip",
  );
  const availableCompanyIds = useMemo(
    () =>
      (companies ?? []).flatMap((item) =>
        item.company && item.company.status !== "closed"
          ? [item.company._id]
          : [],
      ),
    [companies],
  );
  const { actingCompanyId, setActingCompanyId } =
    useActingCompany(availableCompanyIds);
  const [selectedCompanyId, setSelectedCompanyId] = useState<Id<"companies"> | null>(
    actingCompanyId,
  );
  useEffect(() => {
    if (selectedCompanyId && availableCompanyIds.includes(selectedCompanyId)) return;
    setSelectedCompanyId(actingCompanyId);
  }, [actingCompanyId, availableCompanyIds, selectedCompanyId]);
  const actingCompanyCandidate = companies?.find(
    (item) => item.company?._id === actingCompanyId,
  );
  const actingCompany = actingCompanyCandidate?.company
    ? { ...actingCompanyCandidate, company: actingCompanyCandidate.company }
    : undefined;
  const canAdministerActingCompany =
    actingCompany?.membership.role === "owner" ||
    actingCompany?.membership.role === "admin";
  const activeActingCompanyId =
    actingCompany?.company?.status === "active" ? actingCompanyId : null;
  const administration = useQuery(
    api.companies.getAdministration,
    activeActingCompanyId && canAdministerActingCompany ? { companyId: activeActingCompanyId } : "skip",
  );
  const basicCompany = useQuery(
    api.companies.getBasic,
    activeActingCompanyId ? { companyId: activeActingCompanyId } : "skip",
  );
  const companyLogoUrl = useQuery(
    api.companies.getLogoUrl,
    activeActingCompanyId ? { companyId: activeActingCompanyId } : "skip",
  );
  const companyInvitations = useQuery(
    api.companies.listPendingForMe,
    flags.companyModel ? {} : "skip",
  );
  const relationships = useQuery(
    api.relationships.listMine,
    activeActingCompanyId && canAdministerActingCompany
      ? { actingCompanyId: activeActingCompanyId }
      : "skip",
  );
  const relationshipInvitations = useQuery(
    api.relationships.listInvitations,
    activeActingCompanyId && canAdministerActingCompany
      ? { actingCompanyId: activeActingCompanyId }
      : "skip",
  );
  const projectInvitations = useQuery(
    api.sharedProjects.listInvitations,
    activeActingCompanyId && canAdministerActingCompany
      ? { actingCompanyId: activeActingCompanyId }
      : "skip",
  );
  const accessibleProjects = useQuery(
    api.projects.listAccessible,
    currentUser ? {} : "skip",
  );
  const companyProjects = useMemo(
    () => (accessibleProjects ?? []).filter((item) => item.company?._id === activeActingCompanyId && item.projectType === "company"),
    [accessibleProjects, activeActingCompanyId],
  );
  const sharedProjects = useMemo(
    () => (accessibleProjects ?? []).filter((item) => item.company?._id === activeActingCompanyId && item.projectType === "shared"),
    [accessibleProjects, activeActingCompanyId],
  );
  const legacyProjects = useMemo(
    () => (accessibleProjects ?? []).filter((item) => item.projectType === "legacy"),
    [accessibleProjects],
  );
  const decideCompanyInvitation = useMutation(api.companies.decideInvitation);
  const revokeCompanyInvitation = useMutation(api.companies.revokeInvitation);
  const decideRelationshipInvitation = useMutation(
    api.relationships.decideInvitation,
  );
  const decideProjectInvitation = useMutation(
    api.sharedProjects.decideInvitation,
  );
  const leaveRelationship = useMutation(api.relationships.leave);
  const proposeRelationshipRemoval = useMutation(
    api.relationships.proposeRemoval,
  );
  const approveRelationshipRemoval = useMutation(
    api.relationships.approveRemoval,
  );
  const updateMember = useMutation(api.companies.updateMember);
  const setSuspended = useMutation(api.companies.setSuspended);
  const closeCompany = useMutation(api.companies.close);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      if (typeof result === "object" && result !== null && "status" in result && result.status === "expired") {
        throw new Error("invitation_expired");
      }
      setNotice("Saved.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message.replaceAll("_", " ")
          : "The action failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function applyCompanySelection() {
    if (!selectedCompanyId || selectedCompanyId === actingCompanyId) return;
    setActingCompanyId(selectedCompanyId);
    const topProject = selectTopCompanyProject(accessibleProjects ?? [], selectedCompanyId);
    if (!topProject) {
      void navigate({ to: "/workspace" });
      return;
    }
    void navigate({
      to: "/workspace/company-projects/$projectId",
      params: { projectId: topProject.project._id },
      search: {
        companyId: selectedCompanyId,
        groupId: "",
        membershipId: topProject.membership._id,
        view: "channels",
      },
    });
  }

  if (releaseConfigProjection === undefined)
    return (
      <main className="company-hub">
        <section className="track-guided-empty" role="status">
          <h1>Loading companies…</h1>
          <p>Checking company access and workspace settings.</p>
        </section>
      </main>
    );

  if (!flags.companyModel)
    return (
      <main className="company-hub">
        <h1>Companies</h1>
        <p>
          This capability is currently disabled by the server release
          configuration.
        </p>
        <Link to="/workspace">Return to Projects</Link>
      </main>
    );

  return (
    <main aria-busy={busy} className="company-hub">
      <header className="company-hub-header">
        <div>
          <span className="company-eyebrow">Workspace</span>
          <h1>Companies</h1>
          <p>Choose the company you represent, then manage its people and project access.</p>
        </div>
        <div className="company-header-actions">
          <Link className="company-back-link" to="/workspace"><ArrowLeft aria-hidden="true" size={15} /> Back to workspace</Link>
          {actingCompany ? <span className="company-profile-role">{currentUser?.displayName ?? "Your profile"}<strong>{companyRoleLabels[actingCompany.membership.role]}</strong></span> : null}
          {canAdministerActingCompany ? <Link className="company-settings-link" to="/workspace/company/settings"><Settings2 aria-hidden="true" size={15} /> Company settings</Link> : null}
        </div>
      </header>
      {notice ? (
        <p aria-live="polite" className="company-notice">
          {notice}
        </p>
      ) : null}

      <section className="company-switcher-panel">
        <div><label htmlFor="acting-company">Company</label><p>Choose the company you are representing in Track.</p></div>
        {companies === undefined ? (
          <p>Loading Companies…</p>
        ) : companies.length === 0 ? (
          <>
            <p>Create your first Company to start.</p>
            <CreateCompanyForm run={run} />
          </>
        ) : (
          <div className="company-context-controls">
            <NativeSelect
              id="acting-company"
              onChange={(event) =>
                setSelectedCompanyId(event.target.value as Id<"companies">)
              }
              value={selectedCompanyId ?? ""}
            >
              {companies.flatMap((item) =>
                item.company
                  ? [
                      <NativeSelectOption key={item.company._id} value={item.company._id}>
                        {`${item.company.displayName} · @${item.company.normalizedHandle} · ${companyRoleLabels[item.membership.role]}`}
                      </NativeSelectOption>,
                    ]
                  : [],
              )}
            </NativeSelect>
            {selectedCompanyId && selectedCompanyId !== actingCompanyId ? (
              <Button className="company-apply-button" onClick={applyCompanySelection}>
                Apply company
              </Button>
            ) : null}
            <Popover>
              <PopoverTrigger render={<Button className="company-create-trigger" variant="outline" />}>
                <Plus aria-hidden="true" size={14} />
                <span>Create company</span>
                <ChevronDown aria-hidden="true" size={14} />
              </PopoverTrigger>
              <PopoverContent align="end" className="company-create-popover" sideOffset={8}>
                <PopoverHeader>
                  <PopoverTitle>Create another company</PopoverTitle>
                  <PopoverDescription>A separate workspace with its own members and projects.</PopoverDescription>
                </PopoverHeader>
                <CreateCompanyForm run={run} />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </section>

      {actingCompany?.company ? (
        <>
          <nav aria-label="Company page sections" className="company-section-nav">
            <a href="#overview">Overview</a>
            {canAdministerActingCompany ? <><a href="#members">Members</a><a href="#invitations">Invitations</a><a href="#relationships">Relationships</a></> : null}
            <a href="#shared-projects">Shared projects</a>
            <a href="#projects">Projects</a>
          </nav>
          <section className="company-summary" id="overview" aria-labelledby="company-overview-heading">
            <div className="company-summary-identity">{companyLogoUrl ? <img alt={`${actingCompany.company.displayName} logo`} className="company-logo company-logo-image" src={companyLogoUrl} /> : <span className="company-logo" aria-hidden="true">{actingCompany.company.displayName.slice(0, 2).toUpperCase()}</span>}<div><p className="company-eyebrow">Company overview</p><h2 id="company-overview-heading">{actingCompany.company.displayName}</h2><span>@{actingCompany.company.normalizedHandle}</span></div></div>
            <dl><div><dt>Status</dt><dd><span className={`company-status ${actingCompany.company.status}`}>{actingCompany.company.status}</span></dd></div><div><dt>Members</dt><dd><Users aria-hidden="true" size={14} />{basicCompany?.memberCount ?? "—"}</dd></div><div><dt>Projects</dt><dd><FolderKanban aria-hidden="true" size={14} />{basicCompany?.projectCount ?? "—"}</dd></div><div><dt>Your role</dt><dd>{companyRoleLabels[actingCompany.membership.role]}</dd></div></dl>
            {basicCompany?.company.description ? <p className="company-summary-description">{basicCompany.company.description}</p> : null}
          </section>
        </>
      ) : null}

      {actingCompanyId && actingCompany?.company?.status === "suspended" ? (
        <section className="company-panel" id="company-status">
          <h2>Company suspended</h2>
          <p>
            Project and Channel access is paused. An owner can reactivate this
            Company without support intervention.
          </p>
          {actingCompany.membership.role === "owner" ? (
            <Button
              onClick={() =>
                void run(() =>
                  setSuspended({
                    companyId: actingCompanyId,
                    suspended: false,
                  }),
                )
              }
            >
              Reactivate Company
            </Button>
          ) : (
            <p>Ask a Company owner to reactivate it.</p>
          )}
        </section>
      ) : null}

      {actingCompanyId && administration ? (
        <>
          <section className="company-panel" id="members">
            <div className="company-section-heading">
              <div>
                <h2>Members</h2>
                <p>Company membership is separate from project and channel access.</p>
              </div>
              <span className="company-section-count">{administration.members.length}</span>
            </div>
            <ul className="company-list company-member-list">
              <li aria-hidden="true" className="company-member-list-header">
                <span />
                <span>Member</span>
                <span>Role</span>
                <span>Status</span>
                <span />
              </li>
            {administration.members.map(({ membership, user }) => {
              const memberActions = resolveCompanyMemberActionCapabilities({
                actorRole: administration.membership.role,
                isCurrentUser: membership.userId === currentUser?._id,
                targetRole: membership.role,
                targetStatus: membership.status,
              })
              return (
              <li className="company-member-row" key={membership._id}>
                <span className="company-member-avatar" aria-hidden="true">
                  {(user?.displayName ?? membership.userDisplayNameSnapshot).slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>
                    {user?.displayName ?? membership.userDisplayNameSnapshot}
                  </strong>
                  {user?.email ? <span>{user.email}</span> : null}
                </div>
                <span className="company-member-role">{companyRoleLabels[membership.role]}</span>
                <span className="company-member-status" data-status={membership.status}>{membership.status}</span>
                {memberActions.showMenu ? (
                  <details
                    className="company-member-actions"
                    onKeyDown={(event) => {
                      if (event.key !== "Escape") return
                      event.preventDefault()
                      event.currentTarget.removeAttribute("open")
                      event.currentTarget.querySelector<HTMLElement>("summary")?.focus()
                    }}
                  >
                    <summary aria-label={`More actions for ${user?.displayName ?? membership.userDisplayNameSnapshot}`} title="More actions">
                      <MoreHorizontal aria-hidden="true" size={16} />
                    </summary>
                    <div aria-label={`Actions for ${user?.displayName ?? membership.userDisplayNameSnapshot}`} role="group">
                    {memberActions.canChangeRole &&
                    membership.status === "active" &&
                    membership.role !== "admin" ? (
                      <Button
                        onClick={() =>
                          void run(() =>
                            updateMember({
                              companyId: actingCompanyId,
                              companyMemberId: membership._id,
                              role: "admin",
                            }),
                          )
                        }
                        variant="outline"
                      >
                        Make admin
                      </Button>
                    ) : null}
                    {memberActions.canChangeRole &&
                    membership.status === "active" &&
                    membership.role !== "member" ? (
                      <Button
                        onClick={() =>
                          void run(() =>
                            updateMember({
                              companyId: actingCompanyId,
                              companyMemberId: membership._id,
                              role: "member",
                            }),
                          )
                        }
                        variant="outline"
                      >
                        Make member
                      </Button>
                    ) : null}
                    {memberActions.canPromoteToOwner ? (
                      <Button
                        onClick={() =>
                          void run(() =>
                            updateMember({
                              companyId: actingCompanyId,
                              companyMemberId: membership._id,
                              role: "owner",
                            }),
                          )
                        }
                        variant="outline"
                      >
                        Promote to owner
                      </Button>
                    ) : null}
                    {memberActions.canChangeStatus ? <Button
                      onClick={() =>
                        void run(() =>
                          updateMember({
                            companyId: actingCompanyId,
                            companyMemberId: membership._id,
                            status:
                              membership.status === "active"
                                ? "suspended"
                                : "active",
                          }),
                        )
                      }
                      variant="outline"
                    >
                      {membership.status === "active"
                        ? "Suspend"
                        : "Reactivate"}
                    </Button> : null}
                    {memberActions.canChangeStatus ? <Button
                      onClick={() =>
                        void run(() =>
                          updateMember({
                            companyId: actingCompanyId,
                            companyMemberId: membership._id,
                            status: "removed",
                          }),
                        )
                      }
                      variant="destructive"
                    >
                      Remove
                    </Button> : null}
                    </div>
                  </details>
                ) : null}
              </li>
              )
            })}
            </ul>
          </section>

          <section className="company-panel" id="invitations">
            <div className="company-section-heading">
              <div>
                <h2>Invitations</h2>
                <p>Invite company members and review outstanding requests.</p>
              </div>
              {administration.membership.role !== "member" ? (
                <CompanyActionPopover
                  description="Invite a person as a company member or company admin. Project access stays separate."
                  label="Invite member"
                  title="Invite a company member"
                >
                  <InviteMemberForm actingCompanyId={actingCompanyId} run={run} />
                </CompanyActionPopover>
              ) : null}
            </div>
            {administration.invitations.length ? (
              <div className="company-subsection" id="company-pending-invitations">
                <h3>Pending invitations</h3>
                <ul className="company-list">
                  {administration.invitations.map((invitation) => (
                    <li key={invitation._id}>
                      <div><strong>{invitation.normalizedEmail}</strong><span>{companyRoleLabels[invitation.role]} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</span></div>
                      <Button onClick={() => void run(() => revokeCompanyInvitation({ companyId: actingCompanyId, invitationId: invitation._id }))} variant="outline">Revoke</Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {(companyInvitations ?? []).length > 0 ? (
        <section className="company-panel" id="invitations-for-you">
          <div className="company-section-heading">
            <div>
              <h2>Invitations for you</h2>
              <p>Accept or decline companies that invited your account.</p>
            </div>
          </div>
          <ul className="company-list">
            {companyInvitations?.map(({ company, invitation }) => (
              <li key={invitation._id}>
                <div><strong>{company?.displayName}</strong><span>{companyRoleLabels[invitation.role]} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</span></div>
                <div>
                  <Button onClick={() => void run(() => decideCompanyInvitation({ invitationId: invitation._id, decision: "accept" }))}>Accept</Button>
                  <Button onClick={() => void run(() => decideCompanyInvitation({ invitationId: invitation._id, decision: "decline" }))} variant="outline">Decline</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {actingCompanyId &&
      administration &&
      administration.membership.role !== "member" ? (
        <section className="company-panel" id="relationships">
          <div className="company-section-heading">
            <div><h2>Relationships</h2><p>Companies approved to collaborate on shared projects.</p></div>
            <CompanyActionPopover
              description="Connect to one exact company handle. Track keeps company discovery private."
              label="New relationship"
              title="Create a relationship"
            >
              <RelationshipForm actingCompanyId={actingCompanyId} run={run} />
            </CompanyActionPopover>
          </div>
          {(relationshipInvitations ?? []).length ? (
            <ul className="company-list">
              {relationshipInvitations?.map(
                ({ invitation, invitingCompany, relationship }) => (
                  <li key={invitation._id}>
                    <div>
                      <strong>{relationship?.name}</strong>
                      <span>
                        {invitingCompany?.displayName} invited this exact
                        Company.
                      </span>
                    </div>
                    <div>
                      <Button
                        onClick={() =>
                          void run(() =>
                            decideRelationshipInvitation({
                              actingCompanyId,
                              invitationId: invitation._id,
                              decision: "accept",
                            }),
                          )
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        onClick={() =>
                          void run(() =>
                            decideRelationshipInvitation({
                              actingCompanyId,
                              invitationId: invitation._id,
                              decision: "decline",
                            }),
                          )
                        }
                        variant="outline"
                      >
                        Decline
                      </Button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          ) : null}
          <ul className="company-list">
            {relationships?.map((item) => (
              <li key={item.relationship._id}>
                <div>
                  <strong>{item.relationship.name}</strong>
                  <span>
                    {item.relationship.status} ·{" "}
                    {item.participants
                      .map((company) => company.displayName)
                      .join(", ")}
                  </span>
                </div>
                <RelationshipParticipantForm
                  actingCompanyId={actingCompanyId}
                  relationshipId={item.relationship._id}
                  run={run}
                />
                <div>
                  {item.participants
                    .filter((company) => company._id !== actingCompanyId)
                    .map((company) => (
                      <Button
                        key={company._id}
                        onClick={() =>
                          void run(async () => {
                            const requestId = await proposeRelationshipRemoval({
                              actingCompanyId,
                              relationshipId: item.relationship._id,
                              targetCompanyId: company._id,
                              idempotencyKey: crypto.randomUUID(),
                            });
                            await approveRelationshipRemoval({
                              actingCompanyId,
                              requestId,
                            });
                          })
                        }
                        variant="outline"
                      >
                        Request removal of {company.displayName}
                      </Button>
                    ))}
                  {item.pendingRemovalRequests
                    .filter(
                      (request) => request.targetCompanyId !== actingCompanyId,
                    )
                    .map((request) => (
                      <Button
                        key={request._id}
                        onClick={() =>
                          void run(() =>
                            approveRelationshipRemoval({
                              actingCompanyId,
                              requestId: request._id,
                            }),
                          )
                        }
                        variant="outline"
                      >
                        Approve pending removal
                      </Button>
                    ))}
                  <Button
                    onClick={() =>
                      void run(() =>
                        leaveRelationship({
                          actingCompanyId,
                          relationshipId: item.relationship._id,
                        }),
                      )
                    }
                    variant="destructive"
                  >
                    Leave Relationship
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {actingCompanyId && currentUser && actingCompany?.company ? (
        <section className="company-panel" id="shared-projects">
          <div className="company-section-heading">
            <div><h2>Shared projects</h2><p>Projects where this company collaborates with other companies.</p></div>
            {canAdministerActingCompany ? (
              <CompanyActionPopover
                description="Choose an active relationship, then propose a project to its participating companies."
                label="Propose project"
                title="Propose a shared project"
              >
                <SharedProjectForm
                  actingCompanyId={actingCompanyId}
                  currentUserId={currentUser._id}
                  relationships={(relationships ?? []).filter(
                    (item) => item.relationship.status === "active",
                  )}
                  run={run}
                />
              </CompanyActionPopover>
            ) : null}
          </div>
          {(projectInvitations ?? []).length ? (
            <ul className="company-list">
              {projectInvitations?.map(
                ({ invitation, invitingCompany, project }) => (
                  <li key={invitation._id}>
                    <div>
                      <strong>{project?.name}</strong>
                      <span>
                        {invitingCompany?.displayName} proposes shared work;
                        accepting appoints you as the initial manager.
                      </span>
                    </div>
                    <div>
                      <Button
                        onClick={() =>
                          void run(() =>
                            decideProjectInvitation({
                              actingCompanyId,
                              invitationId: invitation._id,
                              decision: "accept",
                              initialMembers: [
                                { userId: currentUser._id, role: "manager" },
                              ],
                            }),
                          )
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        onClick={() =>
                          void run(() =>
                            decideProjectInvitation({
                              actingCompanyId,
                              invitationId: invitation._id,
                              decision: "decline",
                              initialMembers: [],
                            }),
                          )
                        }
                        variant="outline"
                      >
                        Decline
                      </Button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          ) : null}
          <ul className="company-list">
            {sharedProjects.map((item) => (
              <li key={item.membership._id}>
                <div>
                  <strong>{item.project.name}</strong>
                  <span>
                    {item.membership.role} · {item.membership.status} ·
                    represented by {actingCompany.company.displayName} · {item.memberCount} members · {item.channelCount} channels · updated {new Date(item.lastActivityAt).toLocaleDateString()}
                  </span>
                </div>
                <Link
                  params={{ projectId: item.project._id }}
                  search={{
                    companyId: actingCompanyId,
                    groupId: '',
                    membershipId: item.membership._id,
                    view: 'channels',
                  }}
                  to="/workspace/company-projects/$projectId"
                >
                  Open Project
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {actingCompany?.company ? <section className="company-panel company-legacy-projects" id="projects">
        <div className="company-section-heading">
          <div><h2>Company projects</h2><p>Private project spaces owned by this company. Membership is granted separately from company membership.</p></div>
          <div className="company-section-heading-actions">
            <Link search={{ directory: true }} to="/workspace">View all projects</Link>
            {activeActingCompanyId && canAdministerActingCompany ? (
              <CompanyActionPopover
                description="Create a company project. You become its first project manager."
                label="New project"
                title="Create a company project"
              >
                <CompanyProjectForm actingCompanyId={activeActingCompanyId} run={run} />
              </CompanyActionPopover>
            ) : null}
          </div>
        </div>
        <ul className="company-list">
          {companyProjects.map((item) => <li key={item.membership._id}><div><strong>{item.project.name}</strong><span>{actingCompany?.company.displayName} · {item.role} · {item.projectStatus} · {item.memberCount} members · {item.channelCount} channels · updated {new Date(item.lastActivityAt).toLocaleDateString()}</span></div>{item.company ? <Link params={{ projectId: item.project._id }} search={{ companyId: item.company._id, groupId: '', membershipId: item.membership._id, view: 'channels' }} to="/workspace/company-projects/$projectId">Open project</Link> : null}</li>)}
        </ul>
        <div className="company-section-heading"><div><h3>Legacy projects</h3><p>Older projects remain available through the translated legacy access model.</p></div></div>
        <ul className="company-list">
          {legacyProjects.map((item) => <li key={item.membership._id}><div><strong>{item.project.name}</strong><span>Legacy · {item.role} · {item.projectStatus} · {item.memberCount} members · {item.channelCount} channels</span></div><Link params={{ projectId: item.project._id }} to="/workspace/projects/$projectId">Open project</Link></li>)}
        </ul>
      </section> : null}
      {actingCompanyId && administration?.membership.role === "owner" ? (
        <section className="company-panel company-danger-zone" aria-labelledby="company-danger-heading">
          <div className="company-section-heading">
            <div>
              <h2 id="company-danger-heading">Danger zone</h2>
              <p>Suspend access temporarily or permanently close this company.</p>
            </div>
          </div>
          <div className="company-danger-actions">
            <div><strong>Suspend company</strong><span>Pause project and channel access until an owner reactivates it.</span></div>
            <Button onClick={() => void run(() => setSuspended({ companyId: actingCompanyId, suspended: true }))} variant="outline">Suspend company</Button>
          </div>
          <div className="company-danger-actions">
            <div><strong>Close company</strong><span>Close the company after shared-project retention requirements are met.</span></div>
            <Button
              onClick={() => {
                if (window.confirm("Close this company after confirming retention? Shared projects must be exited first; retained history is not erased.")) {
                  void run(() => closeCompany({ companyId: actingCompanyId, retentionConfirmed: true }));
                }
              }}
              variant="destructive"
            >
              Close company
            </Button>
          </div>
        </section>
      ) : null}
      {actingCompanyId &&
      currentUser &&
      administration &&
      administration.membership.role !== "member" ? (
        <details className="company-advanced-disclosure">
          <summary>
            <span><strong>Legacy project upgrade</strong><small>Map an older project into the company access model.</small></span>
            <ChevronDown aria-hidden="true" size={16} />
          </summary>
          <MigrationPanel
            actingCompanyId={actingCompanyId}
            currentUserId={currentUser._id}
            relationships={(relationships ?? []).filter(
              (item) => item.relationship.status === "active",
            )}
            run={run}
          />
        </details>
      ) : null}
    </main>
  );
}
