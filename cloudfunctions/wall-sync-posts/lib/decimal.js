function normalizeDecimal(value, fieldName = "sequence") {
  const text = String(value === undefined || value === null ? "" : value);

  if (!/^(0|[1-9]\d*)$/.test(text)) {
    throw new TypeError(`${fieldName} must be a non-negative decimal string`);
  }

  return text;
}

function compareDecimal(left, right) {
  const a = normalizeDecimal(left, "left sequence");
  const b = normalizeDecimal(right, "right sequence");

  if (a.length !== b.length) {
    return a.length < b.length ? -1 : 1;
  }

  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}

function isNewerSequence(candidate, current) {
  if (current === undefined || current === null || current === "") {
    normalizeDecimal(candidate);
    return true;
  }

  return compareDecimal(candidate, current) > 0;
}

module.exports = { normalizeDecimal, compareDecimal, isNewerSequence };
