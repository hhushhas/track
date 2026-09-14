import type { Id } from "../../../../../convex/_generated/dataModel";

export type GroupReference = {
  _id: Id<"groups">;
  kind: string;
  name: string;
  status?: string;
};
