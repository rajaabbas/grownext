import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { billingUsageQueue, billingInvoiceQueue, closeQueues } from "../src/queue";
import { logger } from "@ma/core";

interface LoadTestArgs {
  organizationId: string;
  subscriptionId: string;
  days: number;
  usageJobsPerDay: number;
  enqueueInvoices: boolean;
}

const parseArg = (flag: string, fallback?: string): string | undefined => {
  const index = process.argv.indexOf(`--${flag}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback;
  }
  return process.argv[index + 1];
};

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  return ["true", "1", "yes"].includes(value.toLowerCase());
};

const parseArgs = (): LoadTestArgs => {
  const organizationId = parseArg("org");
  const subscriptionId = parseArg("subscription");
  const days = Number(parseArg("days", "7"));
  const usageJobsPerDay = Number(parseArg("usage-jobs", "10"));
  const enqueueInvoices = parseBoolean(parseArg("invoices"), true);

  if (!organizationId) {
    throw new Error("Missing required --org argument");
  }
  if (!subscriptionId) {
    throw new Error("Missing required --subscription argument");
  }
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("--days must be a positive number");
  }
  if (!Number.isFinite(usageJobsPerDay) || usageJobsPerDay <= 0) {
    throw new Error("--usage-jobs must be a positive number");
  }

  return {
    organizationId,
    subscriptionId,
    days: Math.floor(days),
    usageJobsPerDay: Math.floor(usageJobsPerDay),
    enqueueInvoices
  };
};

const isoDay = (base: Date, offset: number): { start: string; end: string } => {
  const start = new Date(base);
  start.setUTCDate(start.getUTCDate() + offset);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
};

const main = async () => {
  const args = parseArgs();
  const startedAt = performance.now();
  const base = new Date();

  logger.info(
    {
      organizationId: args.organizationId,
      subscriptionId: args.subscriptionId,
      days: args.days,
      usageJobsPerDay: args.usageJobsPerDay,
      enqueueInvoices: args.enqueueInvoices
    },
    "Starting billing load test enqueue"
  );

  let usageJobs = 0;
  let invoiceJobs = 0;

  for (let dayOffset = 0; dayOffset < args.days; dayOffset += 1) {
    const { start, end } = isoDay(base, -dayOffset);

    for (let i = 0; i < args.usageJobsPerDay; i += 1) {
      await billingUsageQueue.add(
        "billing-usage.load-test",
        {
          organizationId: args.organizationId,
          subscriptionId: args.subscriptionId,
          periodStart: start,
          periodEnd: end,
          resolution: "DAILY",
          backfill: false,
          context: {
            initiatedBy: "cli",
            script: "billing-load-test"
          }
        },
        {
          removeOnComplete: 100,
          removeOnFail: 50
        }
      );
      usageJobs += 1;
    }

    if (args.enqueueInvoices) {
      await billingInvoiceQueue.add(
        "billing-invoice.load-test",
        {
          organizationId: args.organizationId,
          subscriptionId: args.subscriptionId,
          periodStart: start,
          periodEnd: end,
          currency: "usd",
          recurringAmountCents: 0,
          usageCharges: [],
          invoiceNumber: `LT-${start.slice(0, 10)}-${randomUUID().slice(0, 6)}`,
          metadata: {
            initiatedBy: "cli",
            script: "billing-load-test"
          }
        },
        {
          removeOnComplete: 100,
          removeOnFail: 50
        }
      );
      invoiceJobs += 1;
    }
  }

  const durationMs = performance.now() - startedAt;

  logger.info(
    {
      usageJobs,
      invoiceJobs,
      durationMs: Number(durationMs.toFixed(2))
    },
    "Billing load test enqueue complete"
  );
};

main()
  .catch((error) => {
    logger.error({ error }, "Billing load test enqueue failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeQueues();
  });
