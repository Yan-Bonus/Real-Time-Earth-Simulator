# 地球纹理资源

文件：earth-day-2048.jpg，2048 × 1024，266,599 字节，原始 JPEG 未重编码。

- 数据：NASA Blue Marble（2002），Land Surface, Ocean Color and Sea Ice。
- 原始地址：https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg
- 官方说明：https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/
- 使用说明：https://www.nasa.gov/nasa-brand-center/images-and-media/
- Credit: NASA Goddard Space Flight Center. Image by Reto Stöckli; enhancements by Robert Simmon. Data support: MODIS teams, USGS and other credited contributors in the official source.
- 按 NASA 影像使用指南使用并保留来源署名，不表示 NASA 对本应用背书；不包含 NASA 标识。
- SHA-256：D4DC80A6EF571939D0ABE04A9BED3D3D1E6CD63E59514BE1C5E43A6B069E6F1E

等距圆柱投影：水平方向覆盖西经 180° 至东经 180°，垂直方向由北极至南极。使用 Three.js SphereGeometry UV 与默认 flipY；不做人工镜像或上下翻转。颜色纹理以 sRGB 采样。

这是历史拼接地表影像，包含地表颜色与极区冰雪，不是实时天气或实时地表状态，不包含独立云层系统。该旧版本文件仅保留来源记录，当前渲染已改用下述同源底图。

## 当前离线底图：与区域瓦片同源

NASA GIBS BlueMarble_NextGeneration（历史拼接影像），EPSG:4326，原始 WMS JPEG 响应，未重编码。全球范围 -180,-90,180,90。区域瓦片使用同一图层，避免不同历史数据源切换产生颜色变化。

| 文件 | 尺寸 | 字节 | SHA-256 |
| --- | --- | --- | --- |
| earth-blue-marble-8192.jpg | 8192 × 4096 | 2,368,022 | EB28CBD9241EFD75EFA280073E660BA4E7B03F84A939F634B93EDDBD715F0AEB |
| earth-blue-marble-4096.jpg | 4096 × 2048 | 696,838 | 00405B3CB1327F4BF22BDCC987C610FCEAC39BE90F98B6A435B373575EA26297 |
| earth-blue-marble-2048.jpg | 2048 × 1024 | 209,456 | 7F1B66F435C3A21A3DCE6A537818997A28C5A820DD218C45308054DAF2EDDABD |

请求模板（WIDTH=N，HEIGHT=N/2）：
https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=BlueMarble_NextGeneration&STYLES=&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=8192&HEIGHT=4096&FORMAT=image/jpeg

元数据：https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml
署名：NASA / MODIS / NASA Earth Observatory，Blue Marble Next Generation。
官方说明：https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/
接口说明：https://nasa-gibs.github.io/gibs-api-docs/access-basics/
使用指南：https://www.nasa.gov/nasa-brand-center/images-and-media/

启动时按显卡最大纹理尺寸选择 8K/4K/2K 底图，本地基础地球无需联网。只有进入区域尺度才按需访问官方瓦片服务；地域细节最高仍为 500m，并非实时影像。保留署名，不表示 NASA 对应用背书。

## 2026-10-01 海陆显示遮罩

earth-land-mask-4k.png：4096×2048、744,224 字节。SHA-256：5882232c231f3d970b4fd18fbf34458c424ce6f1ed910dc43aec272300c77ff6。

由 Natural Earth 1:10,000,000 陆地多边形栅格化生成，白色陆地、黑色海面，采用等经纬投影。这里的“10m”是地图比例尺名称，不代表 10 米精度。采用 Land 要素，排除原始数据的虚拟 Null island。七项地理采样验证陆地、浅海、日期变更线海面和南极方向。遮罩用于统一观赏海色，不作为测量或精确海岸线工具；小岛、围垦岸线和历史影像可能有像素级偏差。

原始数据：https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson ，2026-10-01 获取。输入 SHA-256：1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416。
来源介绍：https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/ 。许可为公共领域：https://www.naturalearthdata.com/about/terms-of-use/ 。
生成命令：node scripts/build-land-mask.mjs <已下载的 GeoJSON 路径>。原始 10MB GeoJSON 不随应用打包；PNG 随应用离线提供。不新增运行时依赖或网络端点。

最新区域影像支持 EOX Sentinel-2 2024，与离线 NASA 历史来源不同；以上旧“同源/500m 最高”描述仅适用于 NASA 选项。EOX 许可与当前实施边界见 ARCHITECTURE。
