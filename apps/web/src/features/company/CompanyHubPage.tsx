import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";

import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { useReleaseConfig } from "#/lib/release-config";
import {
  CreateCompanyForm,
  CompanyProfileForm,
  InviteMemberForm,
  RelationshipForm,
  RelationshipParticipantForm,
  SharedProjectForm,
} from "./CompanyForms";
import { useActingCompany } from "./use-acting-company";
import { MigrationPanel } from "./MigrationPanel";

export function CompanyHubPage() {
  const flags = useReleaseConfig();
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
  const actingCompany = companies?.find(
    (item) => item.company?._id === actingCompanyId,
  );
  const canAdministerActingCompany =
    actingCompany?.membership.role === "owner" ||
    actingCompany?.membership.role === "admin";
  const activeActingCompanyId =
    actingCompany?.company?.status === "active" ? actingCompanyId : null;
  const administration = useQuery(
    api.companies.getAdministration,
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
  const projects = useQuery(
    api.sharedProjects.listForActingCompany,
    activeActingCompanyId ? { actingCompanyId: activeActingCompanyId } : "skip",
  );
  const decideCompanyInvitation = useMutation(api.companies.decideInvitation);
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
      await action();
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

  if (!flags.companyModel)
    return (
      <main className="company-hub">
        <h1>Company collaboration</h1>
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
          <span className="company-eyebrow">Track Company model</span>
          <h1>Company collaboration</h1>
          <p>
            Relationships make shared work possible; Project and Channel
            membership still control access.
          </p>
        </div>
        <Link to="/workspace">Legacy Projects</Link>
      </header>
      {notice ? (
        <p aria-live="polite" className="company-notice">
          {notice}
        </p>
      ) : null}

      <section className="company-panel">
        <h2>Acting Company</h2>
        {companies === undefined ? (
          <p>Loading Companies…</p>
        ) : companies.length === 0 ? (
          <>
            <p>Create your first Company to start.</p>
            <CreateCompanyForm run={run} />
          </>
        ) : (
          <>
            <label htmlFor="acting-company">Represent Company</label>
            <select
              id="acting-company"
              onChange={(event) =>
                setActingCompanyId(event.target.value as Id<"companies">)
              }
              value={actingCompanyId ?? ""}
            >
              {companies.flatMap((item) =>
                item.company
                  ? [
                      <option key={item.company._id} value={item.company._id}>
                        {item.company.displayName} · @
                        {item.company.normalizedHandle} · {item.membership.role}
                      </option>,
                    ]
                  : [],
              )}
            </select>
            <CreateCompanyForm run={run} />
          </>
        )}
      </section>

      {(companyInvitations ?? []).length > 0 ? (
        <section className="company-panel">
          <h2>Company invitations</h2>
          <ul className="company-list">
            {companyInvitations?.map(({ company, invitation }) => (
              <li key={invitation._id}>
                <div>
                  <strong>{company?.displayName}</strong>
                  <span>
                    {invitation.role} · expires{" "}
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <Button
                    onClick={() =>
                      void run(() =>
                        decideCompanyInvitation({
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
                        decideCompanyInvitation({
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
            ))}
          </ul>
        </section>
      ) : null}

      {actingCompanyId && actingCompany?.company?.status === "suspended" ? (
        <section className="company-panel">
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
        <section className="company-panel">
          <div className="company-panel-heading">
            <div>
              <h2>Company members</h2>
              <p>
                Company membership alone grants no Project or Channel content.
              </p>
            </div>
            {administration.membership.role === "owner" ? (
              <div>
                <Button
                  onClick={() =>
                    void run(() =>
                      setSuspended({
                        companyId: actingCompanyId,
                        suspended: true,
                      }),
                    )
                  }
                  variant="outline"
                >
                  Suspend Company
                </Button>
                <Button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Close this Company after confirming retention? Shared Projects must be exited first; retained history is not erased.",
                      )
                    ) {
                      void run(() =>
                        closeCompany({
                          companyId: actingCompanyId,
                          retentionConfirmed: true,
                        }),
                      );
                    }
                  }}
                  variant="destructive"
                >
                  Close Company
                </Button>
              </div>
            ) : null}
          </div>
          {administration.membership.role !== "member" ? (
            <CompanyProfileForm
              key={actingCompanyId}
              actingCompanyId={actingCompanyId}
              displayName={administration.company.displayName}
              run={run}
            />
          ) : null}
          <ul className="company-list">
            {administration.members.map(({ membership, user }) => (
              <li key={membership._id}>
                <div>
                  <strong>
                    {user?.displayName ?? membership.userDisplayNameSnapshot}
                  </strong>
                  <span>
                    {membership.role} · {membership.status}
                  </span>
                </div>
                {administration.membership.role !== "member" &&
                membership.userId !== currentUser?._id ? (
                  <div>
                    {membership.status === "active" &&
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
                    {membership.status === "active" &&
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
                    {administration.membership.role === "owner" &&
                    membership.status === "active" &&
                    membership.role !== "owner" ? (
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
                    <Button
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
                    </Button>
                    <Button
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
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {administration.membership.role !== "member" ? (
            <InviteMemberForm actingCompanyId={actingCompanyId} run={run} />
          ) : null}
        </section>
      ) : null}

      {actingCompanyId &&
      administration &&
      administration.membership.role !== "member" ? (
        <section className="company-panel">
          <h2>Relationships</h2>
          <RelationshipForm actingCompanyId={actingCompanyId} run={run} />
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

      {actingCompanyId && currentUser && administration ? (
        <section className="company-panel">
          <h2>Shared Projects</h2>
          {administration.membership.role !== "member" ? (
            <SharedProjectForm
              actingCompanyId={actingCompanyId}
              currentUserId={currentUser._id}
              relationships={(relationships ?? []).filter(
                (item) => item.relationship.status === "active",
              )}
              run={run}
            />
          ) : null}
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
            {projects?.map((item) => (
              <li key={item.membership._id}>
                <div>
                  <strong>{item.project.name}</strong>
                  <span>
                    {item.membership.role} · {item.membership.status} ·
                    represented by {administration?.company.displayName}
                  </span>
                </div>
                <Link
                  params={{ projectId: item.project._id }}
                  search={{
                    companyId: actingCompanyId,
                    membershipId: item.membership._id,
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
      {actingCompanyId &&
      currentUser &&
      administration &&
      administration.membership.role !== "member" ? (
        <MigrationPanel
          actingCompanyId={actingCompanyId}
          currentUserId={currentUser._id}
          relationships={(relationships ?? []).filter(
            (item) => item.relationship.status === "active",
          )}
          run={run}
        />
      ) : null}
    </main>
  );
}
