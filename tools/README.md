# Three Studio 開發與驗收

只要操作演練：在儲存庫根目錄執行 `python3 -m http.server --directory web`。不必安裝編輯器、Electron 或 Node。

- 上游 [Three Studio 0.6.0](https://github.com/three-studio/three-studio/releases/tag/0.6.0)，commit `6e315be6dbc9aa28a750d59944c0493d1bf904a0`。
- 依上游原始碼的開發方式執行 Three Studio，再開 `studio-project/`。實際測試的 Linux `.deb` 可以開場景；本機 Play 遇到 esbuild `spawn ENOTDIR`，而 Rapier WebAssembly 被分發版 CSP 擋住。通過的是上游同版 **來源建置**的編輯器 Play，不是 Linux 發布包的 Play。不要更改生產 CSP 或關閉沙盒來排除。
- 兩份場景由上游 core 工廠初始化，再進入編輯器確認物件與實際 Play。`author-studio-scene.mjs` 可在乾淨的上游 checkout 重建初始場景。這會覆寫兩份場景、專案設定和 sidecar；日常調整直接在編輯器操作，不要覆寫手工修改。
- 公開 `Behaviour` 層不直接改 Rapier body。閉門時固定 collider 阻擋；可視門扇動畫完成之後切至明確的開門場景，保留門扇最終位置的側邊 collider，不留正面的幽靈碰撞。開門後回到門外的小幅定位點，仍需玩家自行走進去；若換場景釋放滑鼠擷取，再點畫面。
- 目前 3D 驗證以鍵鼠為主。逐點導覽是同一任務的非 3D 操作，無實際走位或物理碰撞；手機可以選逐點模式。`?qa=1` 僅在 DOM 掛唯讀位置／狀態，不提供移動玩家、開門等捷徑。

## 重新匯出

在指定版本上游安裝官方依賴。本次 Node 24 / npm 11 的 `npm ci` 因 3 筆非本平台可選的 `lightningcss` 記錄缺失被拒，`npm install` 只加回那 3 筆。重包時使用新的輸出資料夾。先將 `PORTFOLIO_ROOT` 設為本專案完整路徑。

```sh
git checkout 6e315be6dbc9aa28a750d59944c0493d1bf904a0
npm install
npm run build:web
cp "$PORTFOLIO_ROOT/tools/export-studio-entry.ts" "$PORTFOLIO_ROOT/tools/export-studio-driver.mjs" .
node export-studio-driver.mjs
node export-studio.bundle.cjs "$PORTFOLIO_ROOT/studio-project" /tmp/xunchang-export
```

CLI 直接呼叫 Three Studio 的原始 `exportBuild`，未手寫播放器或輸出檔；CLI adapter 僅針對本案不含 raster 的資料，若呼叫到 Electron 原生檔或專案最近清單便明確失敗。`web/runtime/inspection-build.json` 是外層介面用的本案標記，不是上游輸出；重包後一併保留標記、授權及相依聲明。

`chromium-runtime-check.cjs` 和 `chromium-host-check.cjs` 可由本機 Electron 43.2.0 另開乾淨測試視窗執行。用 `python3 -m http.server 4182 --directory web` 開站後以 Electron 指向測試檔，無需連到編輯器。軟體 WebGL2 測試不是生產效能量測，也不等同以 Firefox 或手機驗證。

## 本次實測紀錄

- 編輯器：官方 0.6.0 原始碼，Electron 43.2.0 在 Linux 雲端的 WebGL2 軟體渲染，實際 Play 顯示場景並以鍵鼠操作。出口錯誤、編輯器來源版、網頁驗證是不同層次；[Play 截圖](../docs/assets/studio-editor-play.png) 由 Three Studio 自帶 smoke 測試擷取，其 renderer errors 為 none。場景骨架用 core 生成並在 GUI 開啟；本輪不把 GUI 中尚未驗證的編輯／儲存／重開列為已測。
- 原生網頁匯出：2 個場景、3 個原創 GLB、1 個行為腳本，4,997,594 bytes，官方 `exportBuild` 回傳 0 個警告。CLI 使用上游確切來源；不聲稱做過 GUI Package 打包。
- [獨立瀏覽器驗收](../docs/assets/studio-browser-check.json)：Electron 43.2.0 / Chromium 150.0.7871.129 的無 Editor 視窗，WebGL2 SwiftShader；遠距長按 E 只記一次拒絕，閉門 W 到 Z=0.395 m 被實體擋住，切開門場景仍在門外 Z=0.460 m，自行前進至 Z=-3.397 m 後核對 P-02。15 個本機 HTTP 回應無 4xx／5xx。
- [外層介面整合](../docs/assets/studio-browser-integration.json)：實際 iframe 與同源訊息、門與設備的父頁操作、必填欄阻擋、完成並讀回本機 JSON，模式值為 three-studio。父頁操作後可點回 3D 視窗以回到鍵盤移動焦點。Firefox／手機 3D 未測，不宣稱跨瀏覽器完整支援。
