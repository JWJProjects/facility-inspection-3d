# Three Studio 匯出和 HTML 導覽介面

此頁不是自寫 3D 引擎。逐點導覽是獨立的無 GPU 版本。只有以下同源匯出存在且送出 ready，才啟用 3D 模式的任務按鈕。

- 將靜態匯出放入 `web/runtime/`，入口 `web/runtime/index.html`。依上游授權一併保留對應的授權通知。
- 同目錄新增 `inspection-build.json`，內容 `{"schema":1,"entry":"./runtime/index.html"}`。若沒有匯出，勿建立此標記。
- 使用 HTTP 啟動：`python3 -m http.server 4810 --directory web`（從 repo 根目錄），開啟 `http://localhost:4810/`。亦需實測 `web/` 在部署子路徑的行為。入口不要指向站根；資產和模組使用相對路徑。
- 以 `node --test web/session.test.mjs` 測 HTML 逐點模式狀態機。此命令不測瀏覽器、編輯器或 3D 碰撞。

## 視窗協定

所有訊息為 `{channel:'xunchang-v1',type:...}`，`gate-range`、`equipment-range` 另帶 `inRange` 布林值。父頁核對來源網域和 iframe 視窗。子頁也須核對來源網域及 `event.source === window.parent`，目標設為 `location.origin`。沒有星號。

| 方向 | type | 意義 |
|---|---|---|
| 父 → 子 | hello | HTML iframe 載入後觸發；3D 就緒時回 ready 和當前範圍 |
| 父 → 子 | gate-action | 請遊戲按同一個區域規則開門；不得由外頁繞過碰撞或位置條件 |
| 父 → 子 | inspect-equipment | 請遊戲按同一個區域規則核對設備 |
| 子 → 父 | ready | 時鐘、玩家、腳本可接受互動，非單純載入 HTML |
| 子 → 父 | unsupported | 3D 啟動失敗，回逐點導覽 |
| 子 → 父 | gate-range、equipment-range | 玩家是否處於門前或設備互動區 |
| 子 → 父 | gate-denied、equipment-denied | 按了互動但不在對應互動區 |
| 子 → 父 | gate-open、equipment-observed | 真正完成該互動，才進入對應巡檢紀錄 |

重置 3D 時父頁重新建立 iframe。它不使用 localStorage、網路上傳或跨裝置同步；模式保留各自頁內狀態。物理驗收須另外在已匯出播放器完成。逐點導覽與 3D 的下載會清楚標記模式。
