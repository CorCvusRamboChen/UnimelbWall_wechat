const config = require("./constants/config");

function getEnvVersion() {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion || "develop";
  } catch (error) {
    return "develop";
  }
}

App({
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: "基础库版本过低",
        content: "请升级微信后重新打开小程序。",
        showCancel: false
      });
      return;
    }

    const envVersion = getEnvVersion();
    const cloudEnv = config.cloudEnvironments[envVersion];
    const options = { traceUser: false };

    if (cloudEnv) {
      options.env = cloudEnv;
    }

    wx.cloud.init(options);
    this.globalData.cloudEnv = cloudEnv || null;
    this.globalData.envVersion = envVersion;
  },

  globalData: {
    cloudEnv: null,
    envVersion: "develop"
  }
});
