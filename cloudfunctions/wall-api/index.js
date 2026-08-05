const cloud = require("wx-server-sdk");
const { createRepository } = require("./repository");
const { PublicError, errorResponse } = require("./lib/errors");
const { requireParams } = require("./lib/validators");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const repository = createRepository(db);
const handlers = {
  "posts.list": require("./handlers/list-posts"),
  "posts.get": require("./handlers/get-post"),
  "categories.list": require("./handlers/list-categories"),
  "sync.status": require("./handlers/get-sync-status")
};

exports.main = async (event) => {
  try {
    const action = String(event && event.action || "");
    const handler = handlers[action];

    if (!handler) {
      throw new PublicError("UNKNOWN_ACTION", "不支持的操作");
    }

    const params = requireParams(event && event.params);
    return await handler(params, { db, repository });
  } catch (error) {
    return errorResponse(error);
  }
};
