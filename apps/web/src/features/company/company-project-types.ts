import type { FunctionReturnType } from "convex/server";

import type { api } from "../../../../../convex/_generated/api";

type ChannelListEntry = FunctionReturnType<typeof api.channels.list>[number];

type ChannelFromListEntry<Entry> = Entry extends { channel: infer Channel }
  ? Channel
  : Entry;

export type CompanyProjectChannel = ChannelFromListEntry<ChannelListEntry>;
