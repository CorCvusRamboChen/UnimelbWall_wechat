const { normalizeDecimal, compareDecimal } = require("./decimal");
const { SyncError } = require("./errors");

const ENTITIES = new Set(["board", "author", "post", "post_media", "comment"]);
const OPERATIONS = new Set(["upsert", "delete"]);

function invalid(message) {
  return new SyncError("SOURCE_RESPONSE_INVALID", message, { retryable: false });
}

function parseChange(raw, previousSequence) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw invalid("Change must be an object");
  }

  let seq;

  try {
    seq = normalizeDecimal(raw.seq, "change.seq");
  } catch (error) {
    throw invalid(error.message);
  }

  if (previousSequence !== null && compareDecimal(seq, previousSequence) <= 0) {
    throw invalid("Change sequences must be strictly increasing");
  }

  if (!ENTITIES.has(raw.entity) || !OPERATIONS.has(raw.operation)) {
    throw invalid("Unsupported change entity or operation");
  }

  if (typeof raw.entityId !== "string" || !raw.entityId || raw.entityId.length > 128) {
    throw invalid("Change entityId is invalid");
  }

  if (raw.operation === "upsert" && (!raw.data || typeof raw.data !== "object" || Array.isArray(raw.data))) {
    throw invalid("Upsert change must include data");
  }

  if (raw.operation === "delete" && raw.data !== null && raw.data !== undefined) {
    throw invalid("Delete change data must be null");
  }

  const payloadVersion = Number(raw.payloadVersion);

  if (!Number.isInteger(payloadVersion) || payloadVersion !== 1) {
    throw new SyncError("SOURCE_SCHEMA_UNSUPPORTED", "Unsupported payload version", {
      retryable: false
    });
  }

  return {
    seq,
    entity: raw.entity,
    operation: raw.operation,
    entityId: raw.entityId,
    postId: raw.postId ? String(raw.postId) : null,
    occurredAt: raw.occurredAt || null,
    payloadVersion,
    data: raw.operation === "upsert" ? raw.data : null
  };
}

function parseExportPage(raw, expectedSourceInstance) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw invalid("Response must be an object");
  }

  if (String(raw.apiVersion) !== "1") {
    throw new SyncError("SOURCE_SCHEMA_UNSUPPORTED", "Unsupported API version", {
      retryable: false
    });
  }

  if (typeof raw.sourceInstance !== "string" || !raw.sourceInstance) {
    throw invalid("sourceInstance is missing");
  }

  if (expectedSourceInstance && raw.sourceInstance !== expectedSourceInstance) {
    throw new SyncError(
      "SOURCE_INSTANCE_MISMATCH",
      "Export source instance changed",
      { retryable: false }
    );
  }

  if (!Array.isArray(raw.changes) || typeof raw.hasMore !== "boolean") {
    throw invalid("Response page fields are invalid");
  }

  let highWatermark;

  try {
    highWatermark = normalizeDecimal(raw.highWatermark, "highWatermark");
  } catch (error) {
    throw invalid(error.message);
  }

  if (raw.nextCursor !== null && raw.nextCursor !== undefined
      && (typeof raw.nextCursor !== "string" || raw.nextCursor.length > 4096)) {
    throw invalid("nextCursor is invalid");
  }

  if (raw.hasMore === true && !raw.nextCursor) {
    throw invalid("A page with hasMore=true must include nextCursor");
  }

  let previousSequence = null;
  const changes = raw.changes.map((change) => {
    const parsed = parseChange(change, previousSequence);
    previousSequence = parsed.seq;
    return parsed;
  });

  return {
    apiVersion: "1",
    sourceInstance: raw.sourceInstance,
    highWatermark,
    nextCursor: raw.nextCursor || null,
    hasMore: raw.hasMore,
    changes,
    requestId: typeof raw.requestId === "string" ? raw.requestId : null
  };
}

module.exports = { parseChange, parseExportPage };
