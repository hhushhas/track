import { v } from 'convex/values'

import { mutation } from './_generated/server'

const demoUsers = [
  {
    key: 'hasan',
    googleSubject: 'demo:hasan-shoaib',
    email: 'shasanshoaib@gmail.com',
    displayName: 'Hasan Shoaib',
    role: 'owner',
    canReviewAiRecords: true,
  },
  {
    key: 'bilal',
    googleSubject: 'demo:bilal-collabez',
    email: 'bilal@collabez.ae',
    displayName: 'Bilal Ahmed',
    role: 'admin',
    canReviewAiRecords: true,
  },
  {
    key: 'sara',
    googleSubject: 'demo:sara-collabez',
    email: 'sara@collabez.ae',
    displayName: 'Sara Khan',
    role: 'staff',
    canReviewAiRecords: true,
  },
  {
    key: 'omar',
    googleSubject: 'demo:omar-collabez',
    email: 'omar@collabez.ae',
    displayName: 'Omar Farooq',
    role: 'staff',
    canReviewAiRecords: true,
  },
  {
    key: 'noura',
    googleSubject: 'demo:noura-diabmart',
    email: 'noura@diabmart.ae',
    displayName: 'Noura Al Mansoori',
    role: 'client',
    canReviewAiRecords: false,
  },
  {
    key: 'faisal',
    googleSubject: 'demo:faisal-diabmart',
    email: 'faisal@diabmart.ae',
    displayName: 'Faisal Rahman',
    role: 'client',
    canReviewAiRecords: false,
  },
  {
    key: 'reem',
    googleSubject: 'demo:reem-diabmart',
    email: 'reem@diabmart.ae',
    displayName: 'Reem Haddad',
    role: 'client',
    canReviewAiRecords: false,
  },
  {
    key: 'track',
    googleSubject: 'demo:track-assistant',
    email: 'assistant@track.local',
    displayName: 'Track Assistant',
    profileBio: 'Project memory teammate that turns decisions, evidence, risks, and follow-ups into reviewable records.',
    profileDesignation: 'AI project memory teammate',
    role: 'staff',
    canReviewAiRecords: true,
  },
] as const

const demoGroups = [
  { key: 'general', kind: 'general', name: 'General - DiabMart Launch' },
  { key: 'internal', kind: 'internal', name: 'CollabEZ Internal' },
  { key: 'commercials', kind: 'commercials', name: 'Commercials & Sign-off' },
  { key: 'catalog', kind: 'custom', name: 'Catalog & Product Data' },
  { key: 'care', kind: 'custom', name: 'Care, Compliance & Fulfillment' },
  { key: 'growth', kind: 'custom', name: 'Growth Campaigns' },
] as const

const generalMessages = [
  ['noura', 'Morning team. For the screenshot review, can we make the DiabMart workspace show the real launch themes: MOHAP-approved supplies, CGMs, diabetic-friendly groceries, and delivery across all Emirates?'],
  ['hasan', 'Yes. We will keep the project named DiabMart and frame CollabEZ as the vendor managing web, mobile, ecommerce, UX, and launch automation.'],
  ['bilal', 'I added the launch checklist: marketplace homepage, vendor onboarding, product curation, checkout confidence, reorder flows, and customer support handoff.'],
  ['reem', 'Please make vendor verification visible. Our promise is that every seller and product is reviewed before it reaches shoppers.'],
  ['sara', '@track capture vendor verification and product review as an official launch requirement.'],
  ['track', 'Draft Record proposed: Vendor verification and reviewed product catalog must be visible in the launch experience.'],
  ['faisal', 'Delivery messaging should mention Dubai, Abu Dhabi, Sharjah, Ajman, and the rest of the Emirates without promising impossible same-day coverage everywhere.'],
  ['omar', 'Good call. I will write it as fast UAE-wide delivery with emirate-level expectations in checkout.'],
  ['noura', 'The top categories for launch are CGMs, test strips, lancets, low-carb pantry, supplements, foot care, wound care, and diabetes books.'],
  ['hasan', 'Let us also show reorder as a core workflow. People managing diabetes should not rebuild the same cart every month.'],
  ['sara', 'I am adding quick reorder, saved supply lists, and reminders as the main retention loop.'],
  ['reem', 'Can the client summary export show which requests are billable versus included? That would help me share it internally.'],
  ['bilal', 'Yes, that is a billable reporting enhancement unless we keep it to the existing CSV export.'],
  ['track', 'Track Assistant: Reem asked for a client summary export separating billable requests from included scope; Bilal marked it as billable unless limited to CSV.'],
  ['faisal', 'For care content, include a disclaimer that recommendations are informational and customers should consult healthcare professionals for medical decisions.'],
  ['omar', 'Added. We can keep the language friendly and careful: guidance, not diagnosis.'],
  ['noura', 'The homepage should feel calm and trustworthy, not like a discount pharmacy. Safety first, transparency, inclusivity, innovation.'],
  ['hasan', 'That is the design direction. Useful and trusted first, promotional second.'],
  ['sara', '@track what are the open launch blockers?'],
  ['track', 'Current blockers: payment gateway final keys, final vendor import sheet, nutrition label formatting, return policy copy for sterile supplies, and production push notification certificates.'],
] as const

const internalMessages = [
  ['hasan', 'Internal note: make the screenshot look busy but credible. No fake medical advice, no claims we cannot back up, and no made-up patient data.'],
  ['bilal', 'Agreed. Use project operations, launch tasks, scope decisions, and sample team chat instead of pretending we have live customer health records.'],
  ['sara', 'I will keep the UI dense: records, pending drafts, audit trail, members, groups, and assistant answers all populated.'],
  ['omar', 'Need a polished activity stream showing CollabEZ ownership: ecommerce, mobile app, UI/UX, automations, analytics, and deployment readiness.'],
  ['hasan', 'Also create some blocked and in-progress records so the dashboard has shape. All-done screenshots feel staged.'],
  ['bilal', '@track summarize what changed for DiabMart this week.'],
  ['track', 'This week focused on launch positioning, category architecture, vendor verification, reorder flows, UAE delivery copy, and client-safe export reporting.'],
  ['sara', 'I will prepare a walkthrough path: General chat -> Draft Record -> Records -> Commercials -> Audit events.'],
] as const

const commercialMessages = [
  ['reem', 'For commercials, please separate included launch scope from phase-two asks. We need clean approval before adding loyalty, subscriptions, and WhatsApp reorder flows.'],
  ['hasan', 'Understood. Phase one is marketplace launch readiness. Loyalty, subscriptions, WhatsApp reorder, and advanced analytics are separate commercial decisions.'],
  ['bilal', 'I am marking loyalty and WhatsApp reorder as proposed scope changes, not accepted work.'],
  ['faisal', 'Can we still mention those as roadmap without committing dates?'],
  ['hasan', 'Yes. Roadmap language is fine; committed delivery dates need signed scope.'],
  ['track', 'Draft Record proposed: Roadmap items may be shown without dates; delivery commitments require signed scope.'],
] as const

const catalogMessages = [
  ['noura', 'Catalog import v2 has 612 SKUs. CGMs and strips need priority because shoppers search those first.'],
  ['omar', 'I found 38 products missing images and 74 missing short descriptions. I will flag them in the import QA sheet.'],
  ['sara', 'The filters should support brand, category, diabetic-friendly diet tags, stock status, and reorder frequency.'],
  ['reem', 'Please make low-carb and sugar-free filters prominent but avoid overclaiming health benefits.'],
  ['bilal', 'We should add a content QA rule: product cards can describe ingredients and intended use, but not medical outcomes.'],
  ['track', 'Draft Record proposed: Product content must avoid medical outcome claims and stay focused on ingredients, intended use, and verified product details.'],
] as const

const careMessages = [
  ['faisal', 'Support wants canned replies for delivery delays, cold-chain-sensitive items, returns, and vendor replacement requests.'],
  ['sara', 'I will add those to the care playbook and keep them short enough for WhatsApp and email.'],
  ['noura', 'Returns copy must be very clear for sterile supplies, test strips, and items with storage requirements.'],
  ['hasan', 'That policy copy needs client approval before launch. Mark it blocked on DiabMart legal review.'],
  ['track', 'Record update suggested: Returns copy for sterile and storage-sensitive products is blocked until DiabMart legal review.'],
] as const

const growthMessages = [
  ['reem', 'Growth theme for first campaign: one trusted place for diabetic living in the UAE.'],
  ['omar', 'Creative angles: stop searching three places, reorder essentials faster, shop curated diabetic-friendly products, and discover wellness content.'],
  ['sara', 'We can build landing pages for CGM essentials, low-carb pantry, and new diagnosis starter kits.'],
  ['bilal', 'Starter kits might need careful review so they do not feel like medical advice.'],
  ['hasan', 'Keep starter kits as shopping guides, not treatment plans.'],
] as const

const records = [
  ['scope_change', 'billable_scope', 'accepted', 'Client summary export for billable vs included scope', 'Add a client-safe export that separates accepted records, proposed scope, blocked items, and billable changes for DiabMart leadership review.', 'bilal'],
  ['decision', 'official_record', 'accepted', 'DiabMart positioning centers on trusted diabetic living', 'Launch messaging should emphasize one trusted UAE hub for diabetic supplies, diabetic-friendly foods, essential tech, and wellness support.', 'hasan'],
  ['task', 'official_record', 'in_progress', 'Build quick reorder and saved supply lists', 'Customers should be able to repeat monthly essentials without rebuilding carts from scratch.', 'sara'],
  ['blocker', 'official_record', 'blocked', 'Returns copy pending DiabMart legal approval', 'Sterile supplies, test strips, pump consumables, and storage-sensitive products need approved return language before launch.', 'reem'],
  ['task', 'official_record', 'open', 'Import and QA 612 product SKUs', 'Catalog import needs images, short descriptions, diabetic-friendly tags, stock status, and reorder frequency fields checked before publish.', 'omar'],
  ['decision', 'official_record', 'accepted', 'Vendor verification is visible in launch UX', 'The marketplace should communicate that vendors are verified and products are reviewed before appearing for shoppers.', 'noura'],
  ['task', 'official_record', 'in_progress', 'Create UAE delivery expectation copy', 'Checkout and product pages should set fast UAE-wide delivery expectations without overpromising same-day coverage in every Emirate.', 'faisal'],
  ['scope_change', 'billable_scope', 'proposed', 'WhatsApp reorder flow', 'Allow returning customers to reorder saved essentials through WhatsApp prompts and support handoff.', 'hasan'],
  ['scope_change', 'billable_scope', 'proposed', 'Loyalty and subscription roadmap', 'Design phase-two loyalty points and subscription reminders for recurring diabetes supplies.', 'bilal'],
  ['decision', 'official_record', 'accepted', 'Health content stays informational', 'Product and wellness content can guide shoppers but must not diagnose, prescribe, or promise medical outcomes.', 'sara'],
  ['task', 'official_record', 'open', 'Prepare support canned replies', 'Create short replies for delivery delays, cold-chain-sensitive products, returns, vendor replacement requests, and order status.', 'sara'],
  ['question', 'informational', 'open', 'Should CGM landing page include comparison tables?', 'DiabMart asked whether launch should include comparison tables for CGM-related essentials or keep the page category-led.', 'omar'],
  ['task', 'official_record', 'done', 'Set launch group structure in Track', 'Created General, Internal, Commercials, Catalog, Care, and Growth spaces for the DiabMart launch workspace.', 'hasan'],
  ['blocker', 'official_record', 'blocked', 'Payment gateway final keys not received', 'Production checkout cannot be fully verified until final gateway keys are available.', 'bilal'],
  ['task', 'official_record', 'in_progress', 'Draft homepage safety and transparency copy', 'Homepage should feel calm, trustworthy, inclusive, and specific to diabetes shopping in the UAE.', 'reem'],
  ['decision', 'official_record', 'accepted', 'Roadmap may be shown without delivery dates', 'Roadmap items can appear in stakeholder materials if no delivery date is implied before signed scope.', 'hasan'],
  ['task', 'official_record', 'open', 'Create CGM essentials campaign landing page', 'Growth campaign should send shoppers to a focused CGM essentials page with curated products and reorder reminders.', 'omar'],
  ['task', 'official_record', 'open', 'Add vendor onboarding checklist', 'Seller onboarding needs verification, product review, image standards, return policy acknowledgement, and fulfillment SLA steps.', 'noura'],
] as const

const drafts = [
  ['scope_change', 'WhatsApp reorder pilot', 'Proposed phase-two pilot for WhatsApp-based reorder prompts and support-assisted checkout.', 'open', 'pending'],
  ['task', 'Nutrition label formatting QA', 'Review imported nutrition fields for diabetic-friendly foods and make labels consistent across product cards.', 'open', 'pending'],
  ['decision', 'Starter kits are shopping guides', 'Starter kits can help shoppers discover categories but must avoid treatment-plan language.', 'proposed', 'pending'],
  ['blocker', 'Production push certificate missing', 'Mobile push verification is blocked until production notification credentials are installed.', 'blocked', 'pending'],
  ['question', 'CGM comparison table approach', 'Need DiabMart approval on whether CGM essentials page should compare product specs or stay category-led.', 'open', 'pending'],
  ['task', 'Vendor image remediation batch', '38 products are missing images and should be remediated before public launch.', 'open', 'pending'],
  ['scope_change', 'Advanced analytics dashboard', 'Client asked about category-level funnel analytics beyond the current launch reporting scope.', 'proposed', 'pending'],
  ['decision', 'Delivery copy uses emirate-level expectations', 'Delivery language should be UAE-wide but calibrated by Emirate and fulfillment constraints.', 'proposed', 'pending'],
] as const

function minutesAgo(minutes: number) {
  return Date.now() - minutes * 60 * 1000
}

export const seedDiabMartScreenshot = mutation({
  args: {
    resetExistingDemo: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const userIds: Record<string, string> = {}

    for (const user of demoUsers) {
      const existing = await ctx.db
        .query('users')
        .withIndex('by_google_subject', (q) => q.eq('googleSubject', user.googleSubject))
        .unique()

      if (existing) {
        await ctx.db.patch(existing._id, {
          email: user.email,
          displayName: user.displayName,
          profileBio: 'profileBio' in user ? user.profileBio : existing.profileBio,
          profileDesignation: 'profileDesignation' in user ? user.profileDesignation : existing.profileDesignation,
          updatedAt: now,
        })
        userIds[user.key] = existing._id
      } else {
        const id = await ctx.db.insert('users', {
          googleSubject: user.googleSubject,
          email: user.email,
          displayName: user.displayName,
          profileBio: 'profileBio' in user ? user.profileBio : undefined,
          profileDesignation: 'profileDesignation' in user ? user.profileDesignation : undefined,
          twoFactorEnabled: false,
          createdAt: now,
          updatedAt: now,
        })
        userIds[user.key] = id
      }
    }

    const ownerId = userIds.hasan
    const ownerMemberships = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', ownerId as never))
      .collect()

    let projectId: string | null = null
    for (const membership of ownerMemberships) {
      const project = await ctx.db.get(membership.projectId)
      if (
        project?.name === 'DiabMart' ||
        project?.name === 'DiabMart Marketplace Buildout'
      ) {
        projectId = project._id
        break
      }
    }

    if (projectId && args.resetExistingDemo !== false) {
      const projectGroups = await ctx.db
        .query('groups')
        .withIndex('by_project', (q) => q.eq('projectId', projectId as never))
        .collect()
      const projectGroupIds = new Set(projectGroups.map((group) => group._id))
      const messages = await ctx.db.query('messages').collect()
      for (const row of messages) {
        if (row.projectId === projectId) await ctx.db.delete(row._id)
      }
      const existingRecords = await ctx.db.query('records').collect()
      for (const row of existingRecords) {
        if (row.projectId === projectId) await ctx.db.delete(row._id)
      }
      const existingDrafts = await ctx.db.query('draftRecords').collect()
      for (const row of existingDrafts) {
        if (row.projectId === projectId) await ctx.db.delete(row._id)
      }
      const assistantStreams = await ctx.db.query('assistantStreams').collect()
      for (const row of assistantStreams) {
        if (row.projectId === projectId) await ctx.db.delete(row._id)
      }
      const aiReviews = await ctx.db.query('aiReviews').collect()
      for (const row of aiReviews) {
        if (row.projectId === projectId) await ctx.db.delete(row._id)
      }
      const exports = await ctx.db.query('exports').collect()
      for (const row of exports) {
        if (row.projectId === projectId) await ctx.db.delete(row._id)
      }
      const auditEvents = await ctx.db.query('auditEvents').collect()
      for (const row of auditEvents) {
        if (row.projectId === projectId) await ctx.db.delete(row._id)
      }
      const groupMembers = await ctx.db.query('groupMembers').collect()
      for (const membership of groupMembers) {
        if (projectGroupIds.has(membership.groupId)) await ctx.db.delete(membership._id)
      }
      for (const group of projectGroups) await ctx.db.delete(group._id)
      const projectMembers = await ctx.db
        .query('projectMembers')
        .withIndex('by_project', (q) => q.eq('projectId', projectId as never))
        .collect()
      for (const membership of projectMembers) await ctx.db.delete(membership._id)
    }

    if (!projectId) {
      projectId = await ctx.db.insert('projects', {
        name: 'DiabMart',
        clientLabel: 'CollabEZ vendor delivery',
        createdBy: ownerId as never,
        createdAt: now,
        updatedAt: now,
      })
    } else {
      await ctx.db.patch(projectId as never, {
        name: 'DiabMart',
        clientLabel: 'CollabEZ vendor delivery',
        updatedAt: now,
      })
    }

    const groupIds: Record<string, string> = {}
    for (const group of demoGroups) {
      const groupId = await ctx.db.insert('groups', {
        projectId: projectId as never,
        kind: group.kind,
        name: group.name,
        aiReviewSettings: {
          enabled: true,
          frequencyMinutes: group.key === 'internal' ? 45 : 30,
        },
        createdBy: ownerId as never,
        createdAt: now,
        updatedAt: now,
      })
      groupIds[group.key] = groupId
    }

    for (const user of demoUsers) {
      if (user.key === 'track') continue
      await ctx.db.insert('projectMembers', {
        projectId: projectId as never,
        userId: userIds[user.key] as never,
        role: user.role,
        canReviewAiRecords: user.canReviewAiRecords,
        createdAt: now,
        updatedAt: now,
      })

      for (const group of demoGroups) {
        const canJoin =
          user.role === 'owner' ||
          user.role === 'admin' ||
          (user.role === 'staff' && group.kind !== 'commercials') ||
          (user.role === 'client' && ['general', 'catalog', 'care', 'growth'].includes(group.key))
        if (!canJoin) continue
        await ctx.db.insert('groupMembers', {
          projectId: projectId as never,
          groupId: groupIds[group.key] as never,
          userId: userIds[user.key] as never,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    const realUsers = await ctx.db.query('users').collect()
    const screenshotUsers = realUsers.filter(
      (user) =>
        !user.googleSubject.startsWith('demo:') &&
        ['shasanshoaib@gmail.com', 'hhushhas@gmail.com', 'collabez.ae@gmail.com'].includes(
          user.email,
        ),
    )
    for (const user of screenshotUsers) {
      const existingMembership = await ctx.db
        .query('projectMembers')
        .withIndex('by_project_user', (q) =>
          q.eq('projectId', projectId as never).eq('userId', user._id),
        )
        .unique()
      if (!existingMembership) {
        await ctx.db.insert('projectMembers', {
          projectId: projectId as never,
          userId: user._id,
          role: user.email === 'collabez.ae@gmail.com' ? 'admin' : 'owner',
          canReviewAiRecords: true,
          createdAt: now,
          updatedAt: now,
        })
      }
      for (const group of demoGroups) {
        const existingGroupMembership = await ctx.db
          .query('groupMembers')
          .withIndex('by_group_user', (q) =>
            q.eq('groupId', groupIds[group.key] as never).eq('userId', user._id),
          )
          .unique()
        if (existingGroupMembership) continue
        await ctx.db.insert('groupMembers', {
          projectId: projectId as never,
          groupId: groupIds[group.key] as never,
          userId: user._id,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    const messageIds: string[] = []
    const messageBatches = [
      ['general', generalMessages],
      ['internal', internalMessages],
      ['commercials', commercialMessages],
      ['catalog', catalogMessages],
      ['care', careMessages],
      ['growth', growthMessages],
    ] as const
    let messageOffset = 260
    for (const [groupKey, batch] of messageBatches) {
      for (const [authorKey, body] of batch) {
        const messageId = await ctx.db.insert('messages', {
          projectId: projectId as never,
          groupId: groupIds[groupKey] as never,
          authorId: userIds[authorKey] as never,
          body,
          mentions: body.includes('@track') ? [userIds.hasan as never] : [],
          attachmentIds: [],
          createdAt: minutesAgo(messageOffset),
        })
        messageIds.push(messageId)
        messageOffset -= 7
      }
    }

    for (let index = 0; index < records.length; index += 1) {
      const [type, classification, status, title, description, ownerKey] = records[index]
      await ctx.db.insert('records', {
        projectId: projectId as never,
        groupId: groupIds[index % 3 === 0 ? 'commercials' : index % 2 === 0 ? 'catalog' : 'general'] as never,
        sourceMessageIds: messageIds.slice(Math.max(0, index - 2), Math.max(1, index + 1)) as never,
        type,
        classification,
        status,
        title,
        description,
        ownerId: userIds[ownerKey] as never,
        requestedById: userIds[index % 2 === 0 ? 'noura' : 'reem'] as never,
        reviewedBy: userIds.hasan as never,
        reviewedAt: minutesAgo(130 - index * 4),
        createdAt: minutesAgo(125 - index * 4),
        updatedAt: minutesAgo(20 - index),
      })
    }

    for (let index = 0; index < drafts.length; index += 1) {
      const [type, title, description, proposedStatus, status] = drafts[index]
      await ctx.db.insert('draftRecords', {
        projectId: projectId as never,
        groupId: groupIds[index % 2 === 0 ? 'general' : 'catalog'] as never,
        sourceMessageIds: messageIds.slice(index, index + 2) as never,
        type,
        title,
        description,
        proposedStatus,
        proposedOwnerId: userIds[index % 2 === 0 ? 'sara' : 'omar'] as never,
        evidence: [
          {
            messageId: messageIds[index] as never,
            quote: description,
            reason: 'Seed demo evidence for screenshot review.',
          },
        ],
        status,
        createdAt: minutesAgo(68 - index * 3),
        updatedAt: minutesAgo(42 - index * 2),
      })
    }

    const assistantAnswers = [
      'The launch story is cohesive: DiabMart is the trusted UAE diabetic marketplace, while CollabEZ is driving the ecommerce, mobile, UX, automation, and delivery-readiness work.',
      'The strongest screenshot path is General chat, pending Draft Records, accepted Records, and the audit trail. It shows real project control without exposing customer health data.',
      'Open blockers are payment gateway final keys, legal approval on sensitive returns copy, production push certificates, and product image remediation for 38 SKUs.',
      'Billable candidates are client summary exports, WhatsApp reorder, loyalty and subscriptions, and advanced analytics. Keep them proposed until signed scope is approved.',
    ] as const

    for (let index = 0; index < assistantAnswers.length; index += 1) {
      await ctx.db.insert('assistantStreams', {
        projectId: projectId as never,
        groupId: groupIds[index === 1 ? 'internal' : index === 3 ? 'commercials' : 'general'] as never,
        requesterId: userIds[index === 0 ? 'sara' : 'bilal'] as never,
        status: 'completed',
        answer: assistantAnswers[index],
        evidence: [
          {
            messageId: messageIds[index * 3] as never,
            quote: generalMessages[Math.min(index * 3, generalMessages.length - 1)][1],
            reason: 'Seed demo answer evidence.',
          },
        ],
        createdAt: minutesAgo(34 - index * 6),
        updatedAt: minutesAgo(33 - index * 6),
      })
    }

    for (let index = 0; index < 18; index += 1) {
      await ctx.db.insert('auditEvents', {
        projectId: projectId as never,
        groupId: groupIds[index % 2 === 0 ? 'general' : 'catalog'] as never,
        actorId: userIds[index % 3 === 0 ? 'hasan' : index % 3 === 1 ? 'sara' : 'bilal'] as never,
        entityType: index % 3 === 0 ? 'record' : index % 3 === 1 ? 'draftRecord' : 'message',
        entityId: `seed-demo-${index + 1}`,
        action: index % 3 === 0 ? 'record.accepted' : index % 3 === 1 ? 'draft_record.created' : 'message.sent',
        after: {
          demo: true,
          label: `DiabMart screenshot activity ${index + 1}`,
        },
        correlationId: 'seed-demo-diabmart-screenshot',
        createdAt: minutesAgo(95 - index * 3),
      })
    }

    await ctx.db.insert('exports', {
      projectId: projectId as never,
      requestedBy: userIds.hasan as never,
      format: 'pdf',
      preset: 'client_summary',
      filters: {
        client: 'DiabMart',
        vendor: 'CollabEZ',
        demo: true,
      },
      status: 'completed',
      createdAt: minutesAgo(24),
      completedAt: minutesAgo(22),
    })

    return {
      projectId,
      groups: demoGroups.length,
      users: demoUsers.length - 1,
      messages: messageIds.length,
      records: records.length,
      drafts: drafts.length,
      assistantAnswers: assistantAnswers.length,
    }
  },
})
