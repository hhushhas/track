import { v } from 'convex/values'
import { createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex, crossDomain } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth/minimal'
import { twoFactor } from 'better-auth/plugins'

import { components } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import authConfig from './auth.config'

const siteUrl = process.env.SITE_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    appName: 'Track',
    baseURL: siteUrl,
    trustedOrigins: [siteUrl, 'http://localhost:3000', 'https://track.q9labs.ai'],
    database: authComponent.adapter(ctx),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID_WEB ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET_WEB ?? '',
      },
    },
    plugins: [
      crossDomain({ siteUrl }),
      convex({ authConfig }),
      twoFactor({ issuer: 'Track' }),
    ],
  })

export const getAuthUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx)
  },
})

async function getOptionalAuthUser(ctx: GenericCtx<DataModel>) {
  try {
    return await authComponent.getAuthUser(ctx)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthenticated')) {
      return null
    }
    throw error
  }
}

function getAuthUserDisplayName(authUser: {
  name?: string | null
  email?: string | null
}) {
  return authUser.name ?? authUser.email?.split('@')[0] ?? 'Track User'
}

export const ensureCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const authUser = await getOptionalAuthUser(ctx)
    if (!authUser) return null

    const now = Date.now()
    const existing = await ctx.db
      .query('users')
      .withIndex('by_google_subject', (q) => q.eq('googleSubject', authUser._id))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: authUser.email ?? existing.email,
        displayName: getAuthUserDisplayName(authUser),
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('users', {
      googleSubject: authUser._id,
      email: authUser.email ?? '',
      displayName: getAuthUserDisplayName(authUser),
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await getOptionalAuthUser(ctx)
    if (!authUser) return null

    return await ctx.db
      .query('users')
      .withIndex('by_google_subject', (q) => q.eq('googleSubject', authUser._id))
      .unique()
  },
})

export const syncGoogleUser = mutation({
  args: {
    googleSubject: v.string(),
    email: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('users')
      .withIndex('by_google_subject', (q) =>
        q.eq('googleSubject', args.googleSubject),
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        displayName: args.displayName,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('users', {
      googleSubject: args.googleSubject,
      email: args.email,
      displayName: args.displayName,
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const getUser = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId)
  },
})

export const setTwoFactorEnabled = mutation({
  args: {
    userId: v.id('users'),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      twoFactorEnabled: args.enabled,
      updatedAt: Date.now(),
    })
  },
})

export const setAvatar = mutation({
  args: {
    userId: v.id('users'),
    avatarStorageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      avatarStorageId: args.avatarStorageId,
      updatedAt: Date.now(),
    })
  },
})
