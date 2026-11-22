# 巡場｜驗證紀錄

檢查對象是靜態匯出、Three Studio 0.6.0 編輯器來源與逐點流程，不是機關驗收。以下各路徑分開判定。

| 路徑 | 指標 | 結果 |
|---|---|---|
| 資產 | 3 個 GLB 邊界、法線、內嵌資料、可重建雜湊 | 2 項測試通過 |
| 靜態匯出 | 每個原生匯出檔與 manifest 雜湊一致，HTTP 根路徑與子路徑所引用資源 HTTP 200 | 2 項測試通過；僅靜態資源測試 |
| 前端狀態 | 門距離、必填異常、導覽模式隔離、3D 事件規則 | Node 4 項通過 |
| 逐點流程 | Qt WebEngine 實際服務：靠近開門、設備、缺項提示、產生並讀回 JSON；鍵盤測跳頁及開門；390 px 與 200% 放大無水平溢位 | 通過已列項目；不代表手機 3D 或全站無障礙通過 |
| 無可用 GPU | 預設雲端 Chromium 回落至 WebGL2 後未建立 context；外層可保留逐點導覽 | 此瀏覽器不列為 3D 通過 |
| 官方 Linux `.deb` | 可開啟和渲染場景；其正式包裝版 Play | 此環境 Play 遇到腳本子程序 ENOTDIR 與 WASM 被 CSP 阻擋，未通過；不修改正式版安全設定 |
| 同版原始碼編輯器 Play | WebGL 軟體渲染；站遠按 E 不開，關門擋住；靠近開門後走過門框到 P-02 | 已觀察 |
| 獨立網頁 3D | Chromium 150 核心（Electron 43.2.0 獨立測試視窗，非 Three Studio 編輯器），ANGLE SwiftShader/WebGL2 | 遠距長按 E 只判一次且不開門；閉門在 z≈0.395 m 擋住；開門場景仍在門外 z≈0.460 m；玩家走到 z≈−3.397 m 的設備互動區並讀出 P-02。 [原始檢查輸出](assets/studio-browser-check.json) |
| 頁面整合 | 真實 Three Studio iframe 和同源訊息、外層開門與核對、缺項阻擋、讀回標記為 three-studio 的本機 JSON | 通過；[整合檢查輸出](assets/studio-browser-integration.json) |
| 相似度／對比 | [五案機械稽核](design-compare.txt)、[配色驗算](contrast.txt) | 本案 0 個共同指紋，與既有案最高 0.40，低於 0.55 |

未測的瀏覽器、硬體及裝置保留為未驗證，不自動換算成合格。目前未列 Firefox、實體手機或 VR 支援。

## 重跑

```sh
python3 -I tests/test_props.py
python3 -I tests/test_static.py
node --test web/session.test.mjs
```

- 「獨立網頁 3D」使用 [測試腳本](../tools/chromium-runtime-check.cjs) 和只載入本機頁面的隔離測試視窗，收錄 HTTP 請求狀態、移動座標和實際畫面；不是一般訪客必須安裝的元件。瀏覽器缺 GPU 時不要求訪客關閉安全設定，直接使用逐點導覽。
- 兩份場景存的是 Three Studio 的資料格式，初始場景用 [場景建構腳本](../tools/author-studio-scene.mjs) 產生、再由編輯器開啟和驗證。此工具預期放在固定版本 Three Studio 原始碼根目錄中運行。請勿在唯一一份已編輯專案上重跑建構工具。
