import { randomUUID } from "node:crypto";
import { onTestFinished } from "vitest";
import { type Session } from "next-auth";
import { prisma } from "@langfuse/shared/src/db";
import { createOrgProjectAndApiKey } from "@langfuse/shared/src/server";
import { testFeatureFlags } from "@/src/__tests__/fixtures/feature-flags";
import { appRouter } from "@/src/server/api/root";
import { createInnerTRPCContext } from "@/src/server/api/trpc";

const prepare = async () => {
  const { project, org } = await createOrgProjectAndApiKey();
  const owner = await prisma.user.create({
    data: { email: `${randomUUID()}@example.com`, name: "Owner" },
  });
  const other = await prisma.user.create({
    data: { email: `${randomUUID()}@example.com`, name: "Other" },
  });
  onTestFinished(async () => {
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, other.id] } },
    });
  });
  const callerFor = (userId: string, role: "ADMIN" | "VIEWER") => {
    const session: Session = {
      expires: "1",
      user: {
        id: userId,
        canCreateOrganizations: true,
        name: "Session view test user",
        admin: false,
        featureFlags: testFeatureFlags(),
        organizations: [
          {
            id: org.id,
            name: org.name,
            role: "OWNER",
            plan: "cloud:hobby",
            cloudConfig: undefined,
            metadata: {},
            aiFeaturesEnabled: false,
            aiTelemetryEnabled: true,
            projects: [
              {
                id: project.id,
                role,
                retentionDays: 30,
                deletedAt: null,
                hasTraces: false,
                name: project.name,
                metadata: {},
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ],
      },
      environment: {
        enableExperimentalFeatures: false,
        selfHostedInstancePlan: "cloud:hobby",
      },
    };
    return appRouter.createCaller({
      ...createInnerTRPCContext({ session, headers: {} }),
      prisma,
    });
  };
  const input = {
    projectId: project.id,
    name: "Generations",
    filters: [
      {
        column: "type",
        type: "string" as const,
        operator: "=" as const,
        value: "GENERATION",
      },
    ],
    viewMode: "list" as const,
    unmatchedTraces: "hide" as const,
  };
  return { project, owner, other, callerFor, input };
};

describe("session views", () => {
  it("persists all configuration and lets only the creator edit or delete", async () => {
    const { project, owner, other, callerFor, input } = await prepare();
    const creator = callerFor(owner.id, "ADMIN");
    const otherAdmin = callerFor(other.id, "ADMIN");
    const { view } = await creator.sessionViews.create(input);
    expect(view).toMatchObject({
      ...input,
      createdBy: owner.id,
      sourceTableViewPresetId: null,
    });
    await expect(
      otherAdmin.sessionViews.list({ projectId: project.id }),
    ).resolves.toEqual([expect.objectContaining({ id: view.id, ...input })]);
    await expect(
      otherAdmin.sessionViews.update({ ...input, id: view.id, name: "Stolen" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      otherAdmin.sessionViews.delete({ projectId: project.id, id: view.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      creator.sessionViews.update({
        ...input,
        id: view.id,
        name: "Renamed",
        viewMode: "conversational",
        unmatchedTraces: "show",
      }),
    ).resolves.toMatchObject({
      view: {
        name: "Renamed",
        viewMode: "conversational",
        unmatchedTraces: "show",
        filters: input.filters,
      },
    });
    const copy = await otherAdmin.sessionViews.create({
      ...input,
      name: "Copy",
    });
    expect(copy.view).toMatchObject({
      createdBy: other.id,
      sourceTableViewPresetId: null,
      viewMode: "list",
      unmatchedTraces: "hide",
    });
    await creator.sessionViews.delete({ projectId: project.id, id: view.id });
    await expect(
      prisma.sessionView.findUnique({ where: { id: view.id } }),
    ).resolves.toBeNull();
  });

  it("stores independent preferences for each user, including Messages, without changing the shared view", async () => {
    const { project, owner, other, callerFor, input } = await prepare();
    const creator = callerFor(owner.id, "ADMIN");
    const reader = callerFor(other.id, "VIEWER");
    const { view } = await creator.sessionViews.create(input);
    await creator.sessionViews.setPreferences({
      projectId: project.id,
      unpinnedViewIds: ["messages"],
      viewOrder: [view.id],
    });
    await reader.sessionViews.setPreferences({
      projectId: project.id,
      unpinnedViewIds: [view.id],
    });
    await expect(
      creator.sessionViews.preferences({ projectId: project.id }),
    ).resolves.toEqual({ unpinnedViewIds: ["messages"], viewOrder: [view.id] });
    await expect(
      reader.sessionViews.preferences({ projectId: project.id }),
    ).resolves.toEqual({ unpinnedViewIds: [view.id], viewOrder: [] });
    await expect(
      reader.sessionViews.update({ ...input, id: view.id }),
    ).rejects.toBeDefined();
    await expect(
      reader.sessionViews.create({ ...input, name: "Forbidden" }),
    ).rejects.toBeDefined();
    await creator.sessionViews.delete({ projectId: project.id, id: view.id });
    await expect(
      creator.sessionViews.preferences({ projectId: project.id }),
    ).resolves.toEqual({ unpinnedViewIds: ["messages"], viewOrder: [] });
    await expect(
      reader.sessionViews.preferences({ projectId: project.id }),
    ).resolves.toEqual({ unpinnedViewIds: [], viewOrder: [] });
  });

  it("rejects unsaved IDs, cross-project references, and duplicate names", async () => {
    const { project, owner, callerFor, input } = await prepare();
    const caller = callerFor(owner.id, "ADMIN");
    await caller.sessionViews.create(input);
    await expect(
      caller.sessionViews.create({ ...input, name: "  Generations  " }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.sessionViews.setPreferences({
        projectId: project.id,
        viewOrder: ["unsaved"],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const foreign = await createOrgProjectAndApiKey();
    onTestFinished(async () => {
      await prisma.organization.delete({ where: { id: foreign.org.id } });
    });
    const view = await prisma.sessionView.create({
      data: { ...input, projectId: foreign.project.id, createdBy: owner.id },
    });
    await expect(
      caller.sessionViews.setPreferences({
        projectId: project.id,
        unpinnedViewIds: [view.id],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.sessionViews.update({ ...input, id: view.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.sessionViews.delete({ projectId: project.id, id: view.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.sessionViews.list({ projectId: foreign.project.id }),
    ).rejects.toBeDefined();
  });
});
