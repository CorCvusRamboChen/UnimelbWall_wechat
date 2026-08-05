const { isoDate } = require("../lib/serializers");

module.exports = async function getSyncStatus(params, context) {
  const state = await context.repository.getSyncState();

  return {
    ok: true,
    data: {
      status: state && state.status || "unknown",
      last_success_at: state ? isoDate(state.last_success_at) : null
    }
  };
};
