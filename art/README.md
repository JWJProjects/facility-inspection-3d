# 場景素材

| 檔案 | 用途 | 來源 |
|---|---|---|
| `pump-skid.glb` | P-02 可巡檢泵組、控制盒、指示燈與壓力表 | 以本 repo 的程序建模腳本原創 |
| `reservoir.glb` | 場邊儲水設備 | 同上 |
| `control-cabinet.glb` | 場景控制櫃 | 同上 |

三份模型是虛構訓練素材，不代表真實設備的比例、配管或操作方法。模型原點在地面、Y 軸朝上、正面朝 +Z、單位公尺；不含外部貼圖、字型或壓縮解碼器。人物可行走區、門與牆的碰撞體另外在 Three Studio 裡設定，不從模型外觀推測。

重建並檢查：
```sh
python3 -I art/build_props.py
python3 -I tests/test_props.py
```
