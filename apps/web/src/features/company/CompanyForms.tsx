import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";

import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

type AsyncAction = (action: () => Promise<unknown>) => Promise<void>;

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
        void run(() => updateProfile({ companyId: actingCompanyId, displayName }));
      }}
    >
      <div>
        <Label htmlFor="company-profile-name">Company display name</Label>
        <Input id="company-profile-name" onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
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
