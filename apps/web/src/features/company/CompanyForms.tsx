import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type FormEvent } from "react";

import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

type AsyncAction = (action: () => Promise<unknown>) => Promise<void>;

function formatProjectInvitationError(error: unknown) {
  if (!(error instanceof Error)) return "The invitation could not be sent.";
  if (error.message.includes("company_invitation_pending")) {
    return "An invitation for this Company is already pending.";
  }
  if (error.message.includes("company_already_participating")) {
    return "This Company already participates in the Project.";
  }
  if (error.message.includes("owning_company_required")) {
    return "Only the owning Company can invite collaborators.";
  }
  if (error.message.includes("project_relationship_conflict")) {
    return "This Project is already linked to a different Relationship.";
  }
  return "The invitation could not be sent. Try again.";
}

export function CreateCompanyForm({ run }: { run: AsyncAction }) {
  const createCompany = useMutation(api.companies.create);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await createCompany({ displayName, handle });
      setDisplayName("");
      setHandle("");
    });
  }

  return (
    <form
      className="company-inline-form"
      onSubmit={(event) => void submit(event)}
    >
      <div>
        <Label htmlFor="company-name">Company name</Label>
        <Input
          id="company-name"
          onChange={(event) => setDisplayName(event.target.value)}
          required
          value={displayName}
        />
      </div>
      <div>
        <Label htmlFor="company-handle">Private handle</Label>
        <Input
          autoCapitalize="none"
          id="company-handle"
          onChange={(event) => setHandle(event.target.value)}
          required
          value={handle}
        />
      </div>
      <Button type="submit">Create Company</Button>
    </form>
  );
}

export function InviteMemberForm({
  actingCompanyId,
  run,
}: {
  actingCompanyId: Id<"companies">;
  run: AsyncAction;
}) {
  const invite = useMutation(api.companies.inviteMember);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  return (
    <form
      className="company-inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await invite({ companyId: actingCompanyId, email, role });
          setEmail("");
        });
      }}
    >
      <div>
        <Label htmlFor="member-email">Email</Label>
        <Input
          id="member-email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>
      <div>
        <Label htmlFor="member-role">Role</Label>
        <select
          id="member-role"
          onChange={(event) =>
            setRole(event.target.value as "admin" | "member")
          }
          value={role}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <Button type="submit">Invite member</Button>
    </form>
  );
}

export function CompanyProfileForm({
  actingCompanyId,
  displayName: initialDisplayName,
  run,
}: {
  actingCompanyId: Id<"companies">;
  displayName: string;
  run: AsyncAction;
}) {
  const updateProfile = useMutation(api.companies.updateProfile);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  return (
    <form
      className="company-inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        void run(() =>
          updateProfile({ companyId: actingCompanyId, displayName }),
        );
      }}
    >
      <div>
        <Label htmlFor="company-profile-name">Company display name</Label>
        <Input
          id="company-profile-name"
          onChange={(event) => setDisplayName(event.target.value)}
          required
          value={displayName}
        />
      </div>
      <Button type="submit">Save profile</Button>
    </form>
  );
}

export function RelationshipForm({
  actingCompanyId,
  run,
}: {
  actingCompanyId: Id<"companies">;
  run: AsyncAction;
}) {
  const createRelationship = useMutation(api.relationships.create);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const match = useQuery(
    api.companies.discoverExact,
    handle.length >= 3 ? { actingCompanyId, handle } : "skip",
  );
  return (
    <form
      className="company-inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!match) return;
        void run(async () => {
          await createRelationship({
            actingCompanyId,
            name,
            targetCompanyId: match._id,
          });
          setName("");
          setHandle("");
        });
      }}
    >
      <div>
        <Label htmlFor="relationship-name">Relationship name</Label>
        <Input
          id="relationship-name"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </div>
      <div>
        <Label htmlFor="target-handle">Exact Company handle</Label>
        <Input
          autoCapitalize="none"
          id="target-handle"
          onChange={(event) => setHandle(event.target.value)}
          required
          value={handle}
        />
        <span className="company-field-hint">
          {match
            ? `${match.displayName} · @${match.normalizedHandle}`
            : handle.length >= 3
              ? "No exact active Company match."
              : "Track has no public Company directory."}
        </span>
      </div>
      <Button disabled={!match} type="submit">
        Create Relationship
      </Button>
    </form>
  );
}

export function RelationshipParticipantForm({
  actingCompanyId,
  relationshipId,
  run,
}: {
  actingCompanyId: Id<"companies">;
  relationshipId: Id<"relationships">;
  run: AsyncAction;
}) {
  const inviteCompany = useMutation(api.relationships.inviteCompany);
  const [handle, setHandle] = useState("");
  const match = useQuery(
    api.companies.discoverExact,
    handle.length >= 3 ? { actingCompanyId, handle } : "skip",
  );
  return (
    <form
      className="company-inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!match) return;
        void run(async () => {
          await inviteCompany({
            actingCompanyId,
            relationshipId,
            targetCompanyId: match._id,
          });
          setHandle("");
        });
      }}
    >
      <div>
        <Label htmlFor={`relationship-participant-${relationshipId}`}>
          Add exact Company handle
        </Label>
        <Input
          autoCapitalize="none"
          id={`relationship-participant-${relationshipId}`}
          onChange={(event) => setHandle(event.target.value)}
          value={handle}
        />
        <span className="company-field-hint">
          {match
            ? `${match.displayName} · @${match.normalizedHandle}`
            : "No public directory is exposed."}
        </span>
      </div>
      <Button disabled={!match} type="submit">
        Invite Company
      </Button>
    </form>
  );
}

export function InternalProjectForm({
  actingCompanyId,
  currentUserId,
  run,
}: {
  actingCompanyId: Id<"companies">;
  currentUserId: Id<"users">;
  run: AsyncAction;
}) {
  const createProject = useMutation(api.sharedProjects.createInternal);
  const [name, setName] = useState("");

  return (
    <form
      className="company-inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await createProject({
            actingCompanyId,
            initialMembers: [{ userId: currentUserId, role: "manager" }],
            name,
          });
          setName("");
        });
      }}
    >
      <div>
        <Label htmlFor="company-project-name">Project name</Label>
        <Input
          id="company-project-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Website launch"
          required
          value={name}
        />
        <span className="company-field-hint">
          Starts inside this Company. You can invite collaborators later.
        </span>
      </div>
      <Button type="submit">Create Project</Button>
    </form>
  );
}

export function ProjectCompanyInviteForm({
  actingCompanyId,
  options,
  projectId,
  projectMemberId,
  run,
}: {
  actingCompanyId: Id<"companies">;
  options: FunctionReturnType<
    typeof api.sharedProjects.getCollaborationOptions
  >;
  projectId: Id<"projects">;
  projectMemberId: Id<"projectMembers">;
  run: (action: () => Promise<unknown>) => Promise<boolean>;
}) {
  const inviteCompanies = useMutation(api.sharedProjects.inviteCompanies);
  const projectRelationshipId = options.projectRelationshipId ?? undefined;
  const [relationshipId, setRelationshipId] = useState<
    Id<"relationships"> | ""
  >(projectRelationshipId ?? "");
  const [targetCompanyId, setTargetCompanyId] = useState<Id<"companies"> | "">(
    "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligibleRelationships = options.relationships.filter(
    (item) => item.companies.length > 0,
  );
  const selectedRelationshipId =
    projectRelationshipId ??
    (eligibleRelationships.some(
      (item) => item.relationship._id === relationshipId,
    )
      ? relationshipId
      : (eligibleRelationships[0]?.relationship._id ?? ""));
  const selectedRelationship = eligibleRelationships.find(
    (item) => item.relationship._id === selectedRelationshipId,
  );
  const selectedCompanyId = selectedRelationship?.companies.some(
    (company) => company._id === targetCompanyId,
  )
    ? targetCompanyId
    : (selectedRelationship?.companies[0]?._id ?? "");
  const pendingCount = options.pendingInvitations.length;
  const relationshipSelectId = "project-relationship-" + projectId;
  const companySelectId = "project-partner-company-" + projectId;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedRelationshipId || !selectedCompanyId || submitting) return;
    let invitationError: unknown;
    setSubmitting(true);
    setError(null);
    const saved = await run(async () => {
      try {
        await inviteCompanies({
          actingCompanyId,
          projectId,
          projectMemberId,
          relationshipId: selectedRelationshipId,
          targetCompanyIds: [selectedCompanyId],
        });
      } catch (caughtError) {
        invitationError = caughtError;
        throw caughtError;
      }
    });
    if (!saved) setError(formatProjectInvitationError(invitationError));
    setTargetCompanyId("");
    setSubmitting(false);
  }

  return (
    <section className="company-admin-card">
      <strong>Invite a partner Company</strong>
      <p>
        Invite an existing Relationship partner into this same Project. Their
        Company must accept before its members gain access.
      </p>

      {pendingCount > 0 ? (
        <div>
          <span className="company-field-hint">
            {pendingCount} pending{" "}
            {pendingCount === 1 ? "invitation" : "invitations"}
          </span>
          <ul>
            {options.pendingInvitations.map(({ invitation, targetCompany }) => (
              <li key={invitation._id}>
                {targetCompany?.displayName ?? "Unavailable Company"} · pending
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {eligibleRelationships.length > 0 ? (
        <form
          className="company-inline-form"
          onSubmit={(event) => void submit(event)}
        >
          <div>
            <Label htmlFor={relationshipSelectId}>Relationship</Label>
            <select
              disabled={Boolean(projectRelationshipId) || submitting}
              id={relationshipSelectId}
              onChange={(event) => {
                const selected = eligibleRelationships.find(
                  (item) => item.relationship._id === event.target.value,
                );
                setRelationshipId(selected?.relationship._id ?? "");
                setTargetCompanyId("");
                setError(null);
              }}
              value={selectedRelationshipId}
            >
              {eligibleRelationships.map((item) => (
                <option
                  key={item.relationship._id}
                  value={item.relationship._id}
                >
                  {item.relationship.name}
                </option>
              ))}
            </select>
            <span className="company-field-hint">
              {projectRelationshipId
                ? "Invitations stay within this Project’s Relationship."
                : "The first invitation links this Project to the selected Relationship."}
            </span>
          </div>
          <div>
            <Label htmlFor={companySelectId}>Company</Label>
            <select
              disabled={submitting}
              id={companySelectId}
              onChange={(event) => {
                const selected = selectedRelationship?.companies.find(
                  (company) => company._id === event.target.value,
                );
                setTargetCompanyId(selected?._id ?? "");
                setError(null);
              }}
              value={selectedCompanyId}
            >
              {selectedRelationship?.companies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.displayName}
                </option>
              ))}
            </select>
          </div>
          <Button disabled={!selectedCompanyId || submitting} type="submit">
            {submitting ? "Sending invitation…" : "Invite Company"}
          </Button>
        </form>
      ) : (
        <p>
          {pendingCount > 0
            ? "No other partner Companies are available to invite."
            : options.relationships.length > 0
              ? "Every Company in this Relationship already participates in this Project."
              : "No eligible partner Companies. Create an active Relationship in the Company workspace first."}
        </p>
      )}

      {error ? (
        <p aria-live="polite" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function SharedProjectForm({
  actingCompanyId,
  currentUserId,
  relationships,
  run,
}: {
  actingCompanyId: Id<"companies">;
  currentUserId: Id<"users">;
  relationships: Array<{
    relationship: Doc<"relationships">;
    participants: Array<{ _id: Id<"companies">; displayName: string }>;
  }>;
  run: AsyncAction;
}) {
  const propose = useMutation(api.sharedProjects.propose);
  const [name, setName] = useState("");
  const [relationshipId, setRelationshipId] = useState<
    Id<"relationships"> | ""
  >("");
  const selected = relationships.find(
    (item) => item.relationship._id === relationshipId,
  );
  const targets =
    selected?.participants.filter(
      (company) => company._id !== actingCompanyId,
    ) ?? [];
  return (
    <form
      className="company-inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!relationshipId || targets.length === 0) return;
        void run(async () => {
          await propose({
            actingCompanyId,
            initialMembers: [{ userId: currentUserId, role: "manager" }],
            name,
            relationshipId,
            targetCompanyIds: targets.map((company) => company._id),
          });
          setName("");
        });
      }}
    >
      <div>
        <Label htmlFor="shared-project-name">Project name</Label>
        <Input
          id="shared-project-name"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </div>
      <div>
        <Label htmlFor="shared-project-relationship">Relationship</Label>
        <select
          id="shared-project-relationship"
          onChange={(event) =>
            setRelationshipId(event.target.value as Id<"relationships">)
          }
          required
          value={relationshipId}
        >
          <option value="">Select Relationship</option>
          {relationships.map((item) => (
            <option key={item.relationship._id} value={item.relationship._id}>
              {item.relationship.name}
            </option>
          ))}
        </select>
        <span className="company-field-hint">
          {targets.length
            ? `Invites ${targets.map((company) => company.displayName).join(", ")}`
            : "Choose an active multi-Company Relationship."}
        </span>
      </div>
      <Button disabled={!relationshipId || targets.length === 0} type="submit">
        Propose shared Project
      </Button>
    </form>
  );
}
