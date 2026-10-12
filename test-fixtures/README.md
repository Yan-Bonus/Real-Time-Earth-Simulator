# NASA 固定测试瓦片

nasa-beijing-z7.jpeg 为 NASA GIBS BlueMarble_NextGeneration 500m 图层 z=7、row=22、col=131 的原始 JPEG，512 × 512，45,720 字节。

来源：https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_NextGeneration/default/default/500m/7/22/131.jpeg
署名：NASA / MODIS / NASA Earth Observatory，Blue Marble Next Generation。使用指南：https://www.nasa.gov/nasa-brand-center/images-and-media/

仅用于确定性调度/交互测试，测试时复用到各瓦片位置，不能据此验证最终地理观感。真实地理观感必须使用 real 模式截图；此目录不会随应用打包。

## EOX 固定测试瓦片

eox-2024-z13.jpg 为 EOX Sentinel-2 cloudless 2024 WGS84 z13/row2412/col13471 原始 JPEG，256×256，20,464 字节，2026-10-01 获取。

来源：https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024/default/WGS84/13/2412/13471.jpg
署名：© EOX IT Services GmbH · Contains modified Copernicus Sentinel data 2024。
许可：CC BY-NC-SA 4.0（https://creativecommons.org/licenses/by-nc-sa/4.0/），适用条件：https://cloudless.eox.at/pricing 。本仓库用于非商业开发验证；商业分发前需要授权或替换。

固定测试复用样本到不同位置，仅验证矩阵、调度和纹理尺寸。真实地理与画质须使用 real 模式；不随应用打包。
