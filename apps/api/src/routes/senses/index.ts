import type { FastifyPluginAsync } from "fastify";
import { db } from "@anglish/db";

const senseRoutes: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.put<{
    Params: {
      id: string;
    };
    Body: {
      synsetId?: string;
      senseIndex?: number;
      examples?: unknown;
    };
  }>("/senses/:id", async (request, reply) => {
    const senseId = Number.parseInt(request.params.id, 10);
    if (!Number.isFinite(senseId))
      return reply.code(400).send({ error: "Invalid sense id" });

    const rawSynset = request.body.synsetId;
    const senseIndex = request.body.senseIndex;
    const examplesRaw = request.body.examples;

    if (
      typeof senseIndex !== "number"
      || !Number.isFinite(senseIndex)
      || senseIndex < 0
      || !Number.isInteger(senseIndex)
    ) {
      return reply.code(400).send({ error: "Invalid sense index" });
    }
    if (typeof rawSynset !== "string")
      return reply.code(400).send({ error: "Invalid synset id" });
    if (!Array.isArray(examplesRaw) || !examplesRaw.every((e): e is string => typeof e === "string")) {
      return reply.code(400).send({ error: "Invalid examples" });
    }

    const synsetIdTrim = rawSynset.trim();
    const resolvedSynsetId = synsetIdTrim.length > 0 ? synsetIdTrim : null;

    if (resolvedSynsetId) {
      const syn = await db.pool.query(`SELECT id FROM synset WHERE id = $1`, [resolvedSynsetId]);
      if (syn.rowCount === 0)
        return reply.code(400).send({ error: "Synset not found" });
    }

    try {
      const result = await db.pool.query<{
        id: number;
        lemma_id: number;
        synset_id: string | null;
        sense_index: number;
        examples: string[];
      }>(`
        UPDATE sense
        SET
          synset_id = $2,
          sense_index = $3::smallint,
          examples = $4::text[]
        WHERE id = $1
        RETURNING id, lemma_id, synset_id, sense_index, examples
      `, [senseId, resolvedSynsetId, senseIndex, examplesRaw]);

      const row = result.rows[0];
      if (!row)
        return reply.code(404).send({ error: "Sense not found" });

      let gloss = "";
      if (row.synset_id) {
        const glossResult = await db.pool.query<{ gloss: string }>(
          `SELECT gloss FROM synset WHERE id = $1`,
          [row.synset_id],
        );
        gloss = glossResult.rows[0]?.gloss ?? "";
      }

      return {
        id: row.id,
        lemmaId: row.lemma_id,
        synsetId: row.synset_id ?? "",
        senseIndex: row.sense_index,
        examples: row.examples,
        gloss,
      };
    }
    catch (err: unknown) {
      const code = typeof err === "object" && err !== null && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
      if (code === "23505") {
        return reply.code(409).send({
          error: "Another sense already uses this index for this lemma",
        });
      }
      if (code === "23503") {
        return reply.code(400).send({ error: "Invalid synset reference" });
      }
      request.log.error(err);
      return reply.code(500).send({ error: "Failed to update sense" });
    }
  });
};

export default senseRoutes;
