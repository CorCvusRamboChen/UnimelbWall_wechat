const { PublicError } = require("./errors");

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireParams(value) {
  if (value === undefined || value === null) {
    return {};
  }

  if (!plainObject(value)) {
    throw new PublicError("INVALID_PARAMS", "请求参数格式不正确");
  }

  return value;
}

function parseId(value, field = "id", maxLength = 128) {
  if (typeof value !== "string") {
    throw new PublicError("INVALID_PARAMS", `${field} 格式不正确`);
  }

  const id = value.trim();

  if (!id || id.length > maxLength || /[\u0000-\u001f]/.test(id)) {
    throw new PublicError("INVALID_PARAMS", `${field} 格式不正确`);
  }

  return id;
}

function parseLimit(value) {
  if (value === undefined || value === null || value === "") {
    return 20;
  }

  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new PublicError("INVALID_PARAMS", "limit 必须是 1 到 20 的整数");
  }

  return limit;
}

function parseCategoryId(value) {
  if (value === undefined || value === null || value === "") {
    return "all";
  }

  return parseId(value, "categoryId", 80);
}

module.exports = {
  plainObject,
  requireParams,
  parseId,
  parseLimit,
  parseCategoryId
};
