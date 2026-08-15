const wallApi = require("../../services/wall-api");
const { formatDate } = require("../../utils/date");

function statusPresentation(value) {
  const normalized = String(value || "unknown").toLowerCase();
  const labels = {
    healthy: "同步正常",
    degraded: "同步延迟",
    unhealthy: "同步异常",
    unknown: "状态未知"
  };

  return {
    label: labels[normalized] || "状态未知",
    tone: normalized === "healthy" ? "healthy" : (normalized === "unknown" ? "unknown" : "warning")
  };
}

Page({
  data: {
    loading: true,
    status: null
  },

  async onLoad() {
    try {
      const status = await wallApi.getSyncStatus();
      const presentation = statusPresentation(status.status);
      this.setData({
        status: {
          ...status,
          status_label: presentation.label,
          status_tone: presentation.tone,
          last_success_at_text: formatDate(status.last_success_at)
        }
      });
    } catch (error) {
      this.setData({ status: null });
    } finally {
      this.setData({ loading: false });
    }
  }
});
