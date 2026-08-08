import type { DatabaseClient } from "./database";

export interface ExperimentRecord { id: string; name: string; goal: string; hypothesis: string; variable: string; control: string | null; primaryMetric: string; guardrailMetric: string | null; startsAt: string | null; endsAt: string | null; status: "draft" | "running" | "completed" | "cancelled"; result: string | null; conclusion: string | null; createdAt: string; updatedAt: string; }
export function createExperimentRepository(database: DatabaseClient) {
  return {
    async insert(experiment: ExperimentRecord) {
      await database.prepare("INSERT INTO experiments (id, name, goal, hypothesis, variable, control, primary_metric, guardrail_metric, starts_at, ends_at, status, result, conclusion, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(experiment.id, experiment.name, experiment.goal, experiment.hypothesis, experiment.variable, experiment.control, experiment.primaryMetric, experiment.guardrailMetric, experiment.startsAt, experiment.endsAt, experiment.status, experiment.result, experiment.conclusion, experiment.createdAt, experiment.updatedAt).run();
      return experiment;
    },
    async list() {
      const result = await database.prepare("SELECT id, name, goal, hypothesis, variable, control, primary_metric AS primaryMetric, guardrail_metric AS guardrailMetric, starts_at AS startsAt, ends_at AS endsAt, status, result, conclusion, created_at AS createdAt, updated_at AS updatedAt FROM experiments ORDER BY updated_at DESC").all<ExperimentRecord>();
      return result.results;
    },
  };
}
