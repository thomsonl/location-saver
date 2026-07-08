import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import type { ExtractionJob, UserPrefs } from "./types.js";
import { runPipeline } from "./pipeline/index.js";

/**
 * Ingest API — the endpoint the mobile share extensions hit.
 * Must ack fast (the iOS share extension has a short execution window), so
 * the pipeline runs after the 202 is returned. M0 keeps state in memory;
 * production swaps in Postgres + a job queue.
 */
const app = Fastify({ logger: true });

const jobs = new Map<string, ExtractionJob>();
const userPrefs = new Map<string, UserPrefs>(); // TODO: Postgres

app.post<{ Body: { url: string; userId: string } }>("/v1/ingest", async (req, reply) => {
  const { url, userId } = req.body ?? {};
  if (!url || !userId) {
    return reply.code(400).send({ error: "url and userId are required" });
  }

  const job: ExtractionJob = {
    id: randomUUID(),
    userId,
    sourceUrl: url,
    platform: "unknown",
    status: "queued",
    evidence: [],
    places: [],
    createdAt: new Date(),
  };
  jobs.set(job.id, job);

  const user: UserPrefs = userPrefs.get(userId) ?? { userId, target: "google" };

  // Fire-and-forget: the share extension only needs the 202.
  runPipeline(job, user).catch((err) => {
    app.log.error({ err, jobId: job.id }, "pipeline failed");
    job.status = "failed";
  });

  return reply.code(202).send({ jobId: job.id });
});

app.get<{ Params: { id: string } }>("/v1/saves/:id", async (req, reply) => {
  const job = jobs.get(req.params.id);
  if (!job) return reply.code(404).send({ error: "not found" });
  return job;
});

app.put<{ Body: UserPrefs; Params: { userId: string } }>(
  "/v1/users/:userId/prefs",
  async (req) => {
    const prefs = { ...req.body, userId: req.params.userId };
    userPrefs.set(prefs.userId, prefs);
    return prefs;
  },
);

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: "0.0.0.0" });
