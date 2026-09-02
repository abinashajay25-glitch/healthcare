import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { assistantContextSchema, assistantMessageSchema, createAssistantReply } from "./assistant";
import { analyzePrescription, verifyPrescription } from "./sovereign";

const prescriptionSchema = z.object({
  id: z.string(), medication: z.string(), dose: z.string(), expiresAt: z.string(), integrityHash: z.string(), signature: z.string(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  prescriptions: router({
    verify: publicProcedure.input(z.object({ payload: prescriptionSchema, trusted: prescriptionSchema, now: z.string().datetime().optional() })).query(({ input }) => verifyPrescription(input.payload, input.trusted, input.now ? new Date(input.now) : new Date())),
  }),
  intelligence: router({
    analyze: protectedProcedure.input(z.object({ medication: z.string(), dose: z.string(), allergies: z.array(z.string()), activeMedications: z.array(z.string()) })).mutation(({ input }) => analyzePrescription(input)),
  }),
  access: router({
    request: protectedProcedure.input(z.object({ patientId: z.string(), reason: z.string(), fields: z.array(z.string()).min(1), expiresAt: z.string().datetime() })).mutation(({ ctx, input }) => ({ status: "pending" as const, requestedBy: ctx.user.openId, ...input })),
  }),
  assistant: router({
    chat: publicProcedure.input(z.object({
      messages: z.array(assistantMessageSchema).min(1).max(20),
      context: assistantContextSchema,
    })).mutation(({ input }) => createAssistantReply(input.messages, input.context)),
  }),
});

export type AppRouter = typeof appRouter;
