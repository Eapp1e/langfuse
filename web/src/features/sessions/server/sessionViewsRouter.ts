import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  Prisma,
  SessionViewInputSchema,
  SessionViewPreferencesSchema,
} from "@langfuse/shared";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import {
  hasProjectAccess,
  throwIfNoProjectAccess,
} from "@/src/features/rbac/utils/checkProjectAccess";

export const sessionViewsRouter = createTRPCRouter({
  list: protectedProjectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "TableViewPresets:read",
      });
      const views = await ctx.prisma.sessionView.findMany({
        where: { projectId: input.projectId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          createdByUser: { select: { name: true, email: true, image: true } },
        },
      });
      const canReadMembers = hasProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "projectMembers:read",
      });
      return views.map((view) => ({
        ...view,
        filters: SessionViewInputSchema.shape.filters.parse(view.filters),
        createdByUser: view.createdByUser
          ? {
              ...view.createdByUser,
              email: canReadMembers ? view.createdByUser.email : null,
            }
          : null,
      }));
    }),
  create: protectedProjectProcedure
    .input(SessionViewInputSchema)
    .mutation(async ({ ctx, input }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "TableViewPresets:CUD",
      });
      try {
        const view = await ctx.prisma.sessionView.create({
          data: { ...input, createdBy: ctx.session.user.id },
        });
        return {
          view: {
            ...view,
            filters: SessionViewInputSchema.shape.filters.parse(view.filters),
          },
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A session view with this name already exists.",
          });
        }
        throw error;
      }
    }),
  update: protectedProjectProcedure
    .input(SessionViewInputSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "TableViewPresets:CUD",
      });
      const { id, projectId, ...data } = input;
      try {
        const view = await ctx.prisma.sessionView.update({
          where: { id, projectId, createdBy: ctx.session.user.id },
          data,
        });
        return {
          view: {
            ...view,
            filters: SessionViewInputSchema.shape.filters.parse(view.filters),
          },
        };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2025")
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Only the creator can edit this view.",
            });
          if (error.code === "P2002")
            throw new TRPCError({
              code: "CONFLICT",
              message: "A session view with this name already exists.",
            });
        }
        throw error;
      }
    }),
  delete: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "TableViewPresets:CUD",
      });
      await ctx.prisma.$transaction(async (tx) => {
        const result = await tx.sessionView.deleteMany({
          where: { ...input, createdBy: ctx.session.user.id },
        });
        if (result.count === 0)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the creator can delete this view.",
          });
        await tx.$executeRaw`
          UPDATE session_view_preferences
          SET unpinned_view_ids = array_remove(unpinned_view_ids, ${input.id}),
              view_order = array_remove(view_order, ${input.id}),
              updated_at = CURRENT_TIMESTAMP
          WHERE project_id = ${input.projectId}
        `;
      });
    }),
  preferences: protectedProjectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "TableViewPresets:read",
      });
      return (
        (await ctx.prisma.sessionViewPreference.findUnique({
          where: {
            projectId_userId: {
              projectId: input.projectId,
              userId: ctx.session.user.id,
            },
          },
          select: { unpinnedViewIds: true, viewOrder: true },
        })) ?? { unpinnedViewIds: [], viewOrder: [] }
      );
    }),
  setPreferences: protectedProjectProcedure
    .input(
      SessionViewPreferencesSchema.partial().extend({ projectId: z.string() }),
    )
    .mutation(async ({ ctx, input }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "TableViewPresets:read",
      });
      const { projectId, ...data } = input;
      const ids = [...(data.unpinnedViewIds ?? []), ...(data.viewOrder ?? [])];
      const views = await ctx.prisma.sessionView.findMany({
        where: { projectId, id: { in: ids } },
        select: { id: true },
      });
      const validIds = new Set(["messages", ...views.map((view) => view.id)]);
      if (ids.some((id) => !validIds.has(id))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Preferences must reference saved views in this project or Messages.",
        });
      }
      return ctx.prisma.sessionViewPreference.upsert({
        where: { projectId_userId: { projectId, userId: ctx.session.user.id } },
        create: { projectId, userId: ctx.session.user.id, ...data },
        update: data,
        select: { unpinnedViewIds: true, viewOrder: true },
      });
    }),
});
