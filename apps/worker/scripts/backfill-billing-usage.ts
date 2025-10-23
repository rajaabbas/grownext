import { billingUsageQueue, closeQueues } from "../src/queue";
import { logger } from "@ma/core";

type Resolution = "DAILY" | "WEEKLY" | "MONTHLY";

type DateRange = { periodStart: Date; periodEnd: Date };

const parseArg = (flag: string): string | undefined => {
  const index = process.argv.indexOf(`--${flag}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
};

const ensureDate = (value: string | undefined, name: string): Date => {
  if (!value) {
    throw new Error(`Missing required --${name} argument`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${name} date: ${value}`);
  }
  return date;
};

const parseArgs = () => {
  const organizationId = parseArg("org");
  const subscriptionId = parseArg("subscription");
  const start = ensureDate(parseArg("start"), "start");
  const end = ensureDate(parseArg("end"), "end");
  const featureKeysArg = parseArg("features");
  const resolution = (parseArg("resolution") ?? "DAILY").toUpperCase() as Resolution;

  if (!organizationId) {
    throw new Error("Missing required --org argument");
  }
  if (!subscriptionId) {
    throw new Error("Missing required --subscription argument");
  }
  if (!["DAILY", "WEEKLY", "MONTHLY"].includes(resolution)) {
    throw new Error(`Unsupported resolution: ${resolution}`);
  }
  if (end <= start) {
    throw new Error("--end must be after --start");
  }

  return {
    organizationId,
    subscriptionId,
    start,
    end,
    featureKeys: featureKeysArg
      ? featureKeysArg.split(",").map((key) => key.trim()).filter(Boolean)
      : undefined,
    resolution
  };
};

const formatISO = (value: Date): string => new Date(value).toISOString();

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
};

const createDailyRanges = (start: Date, end: Date): DateRange[] => {
  const ranges: DateRange[] = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const next = addDays(cursor, 1);
    ranges.push({
      periodStart: new Date(cursor),
      periodEnd: new Date(Math.min(next.getTime(), end.getTime()))
    });
    cursor = next;
  }
  return ranges;
};

const createWeeklyRanges = (start: Date, end: Date): DateRange[] => {
  const ranges: DateRange[] = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const next = addDays(cursor, 7);
    ranges.push({
      periodStart: new Date(cursor),
      periodEnd: new Date(Math.min(next.getTime(), end.getTime()))
    });
    cursor = next;
  }
  return ranges;
};

const createMonthlyRanges = (start: Date, end: Date): DateRange[] => {
  const ranges: DateRange[] = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const next = new Date(cursor);
    next.setUTCMonth(next.getUTCMonth() + 1);
    ranges.push({
      periodStart: new Date(cursor),
      periodEnd: new Date(Math.min(next.getTime(), end.getTime()))
    });
    cursor = next;
  }
  return ranges;
};

const RANGE_BUILDERS: Record<Resolution, (start: Date, end: Date) => DateRange[]> = {
  DAILY: createDailyRanges,
  WEEKLY: createWeeklyRanges,
  MONTHLY: createMonthlyRanges
};

const main = async () => {
  const args = parseArgs();
  const ranges = RANGE_BUILDERS[args.resolution](args.start, args.end);

  logger.info(
    {
      organizationId: args.organizationId,
      subscriptionId: args.subscriptionId,
      resolution: args.resolution,
      featureKeys: args.featureKeys ?? null,
      periods: ranges.length
    },
    "Enqueuing billing usage backfill jobs"
  );

  let enqueued = 0;

  for (const range of ranges) {
    await billingUsageQueue.add(
      "billing-usage.backfill",
      {
        organizationId: args.organizationId,
        subscriptionId: args.subscriptionId,
        periodStart: formatISO(range.periodStart),
        periodEnd: formatISO(range.periodEnd),
        resolution: args.resolution,
        featureKeys: args.featureKeys,
        backfill: true,
        context: {
          initiatedBy: "cli",
          script: "backfill-billing-usage"
        }
      },
      {
        jobId: `billing-usage:${args.organizationId}:${args.subscriptionId}:${args.resolution}:${range.periodStart.toISOString()}`,
        removeOnComplete: 100,
        removeOnFail: 50
      }
    );
    enqueued += 1;
  }

  logger.info({ enqueued }, "Billing usage backfill jobs enqueued");
};

main()
  .catch((error) => {
    logger.error({ error }, "Failed to enqueue billing usage backfill jobs");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeQueues();
  });
