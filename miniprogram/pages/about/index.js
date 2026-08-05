const wallApi = require("../../services/wall-api");
const { formatDate } = require("../../utils/date");

Page({
  data: {
    loading: true,
    status: null
  },

  async onLoad() {
    try {
      const status = await wallApi.getSyncStatus();
      this.setData({
        status: {
          ...status,
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
