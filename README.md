# Real-Time Earth Simulator

沉浸式3D地球观赏桌面软件，Electron + React + TypeScript + Three.js。当前源码：**0.4.0-alpha.8**，持续迭代到V1.0；当前不代表正式稳定版。

## 功能

- 真实地表影像、内置128块全球影像拼成的资源包；区域高清联网细化并永久保存。
- 拖动旋转、缩放（最近1.5R）、太阳昼夜、晨昏辅助线与基础大气。
- 暂停/继续、正放/倒放、多倍率、UTC历史未来日期及四季近似日期。
- 独立开关的星空、星云、流星；1573城市、中文稀疏标注与镜头聚焦。
- 行政节点：首都双圆、一级行政中心空心圆、普通城市小实心圆。

## 本地运行

需要Node.js 22.12或更高版本及npm，首次安装需要联网。

```sh
npm ci
npm run check
npm run dev
```

`dev`启动独立Electron窗口；`dev:web`仅供辅助预览。Windows/macOS/Linux共用源码，但目前主要在Windows验证，不能保证其他平台所有行为已验收。

```sh
npm run pack
```

输出到release/。公开源码包含项目维护者提供并确认允许分发的应用图标与背景音乐。音乐默认循环播放，支持开关及音量调节，不提供选曲界面。这些素材不自动适用代码MIT许可。

## 数据与网络

EOX2024影像为历史合成，**不是实时天气/地表**。地球时间与自转可实时运行，但科学计算包含近似。高清联网区域按需加载，缺失网络细节不等于完整高清。Windows影像库默认D:/RealTimeEarthSimulatorData/imagery；不设固定容量、不自动清除，空间不足时暂停新增保存。没有D盘的Windows用户应先配置electron/main.ts中的数据路径。

**代码MIT不等于所有素材允许商用。** EOX2024影像遵循CC BY-NC-SA 4.0；城市描述、来源数据、NASA资源分别遵守自身条款，详见[资源许可](THIRD_PARTY_NOTICES.md)。

## 验证与限制

```sh
npm run check
node --test scripts/*.test.mjs
```

部分桌面诊断脚本依赖私有测试影像库、音乐或旧版本资源，不适合作为公开仓库通用CI。已知重绘及窗口活动异常的结论边界见[版本状态](docs/STATUS.md)。自动测试不能替代视觉与交互验收。

## 开源协议

原始应用代码按[MIT](LICENSE)发布，第三方资源保持原许可。

