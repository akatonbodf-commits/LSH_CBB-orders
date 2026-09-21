/**
 * 共通 API クライアント ＆ レジ端末ID管理モジュール
 */
const ApiClient = {
  regIdKey: "LASALLE_POS_REG_ID",

  // 端末固有のレジIDを取得（なければ自動生成して保存）
  getRegId() {
    let regId = localStorage.getItem(this.regIdKey);
    if (!regId) {
      regId = "POS-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem(this.regIdKey, regId);
    }
    return regId;
  },

  // GASバックエンドへのリクエスト送信（Web Apps API / google.script.run 両対応）
  async request(action, payload = {}) {
    payload.regId = this.getRegId(); // 全リクエストにレジIDを自動付与

    return new Promise((resolve, reject) => {
      // GASの google.script.run 環境下での実行
      if (typeof google !== "undefined" && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler(response => {
            if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error ? response.error.message : "不明なエラーが発生しました。"));
            }
          })
          .withFailureHandler(err => reject(err))
          .doPost({
            postData: {
              contents: JSON.stringify({ action, payload })
            }
          });
      } else {
        // スタンドアロンテスト用の fetch 互換コード
        reject(new Error("GAS実行環境（google.script.run）が見つかりません。"));
      }
    });
  }
};
