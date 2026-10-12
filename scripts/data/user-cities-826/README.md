# 城市参考数据（供 Agent 读取）

本版本共 **826 条城市记录**，覆盖 **195 个国家**。中国 308 条，国外 518 条。之前提到的约 830 是粗略估计；本文件按来源筛选和去重，未补入不符合条件的城市来凑数。

## 文件入口

- `cities.jsonl`：推荐入口，UTF-8 无 BOM；每行是独立 JSON 对象。
- `cities.json`：相同记录的 JSON 数组，便于一次性载入。
- `city-record.schema.json`：单条记录的 JSON Schema。
- `countries.json`：195 个国家的中英文名、ISO3 编码和入选城市数。
- `validation.json`：结构校验、缺失许可列表、去重记录和坐标类型统计。
- `manifest.json`：文件大小和 SHA-256，可检查文件完整性。

## 筛选口径与时间

中国大陆纳入 4 个直辖市和 293 个地级市，共 297 座；不纳入县、县级市、自治州、地区、盟，也不把市辖区拆成城市。香港、澳门各 1 条；台湾纳入 6 个直辖市和 3 个市，共 9 条。中国合计 308 条。大陆名录逐一与民政部行政区划代码表核对。该名录对应所列官方来源的时间，不能据此断言 2026 年行政区划没有变化。

国外采用联合国《World Urbanization Prospects 2025》的城市聚居区定义：2025 年人口不少于 1,000,000 的聚居区，加上该资料所列国家首都；行政、立法、司法等分设首都一并保留。这里的百万门槛不是行政市常住人口门槛。城市名称有时是聚居区代表地名，因此小城镇名称也可能对应百万级聚居区。首都名单同样是该资料快照，不表示逐国核验过 2026 年的最新迁都状态。

国家范围为联合国 193 个会员国与 2 个观察员国。本数据将中国香港、澳门及台湾城市归入 CHN，未重复纳入国外部分。争议领土与首都归属按联合国原表保留，不表达额外的地位判断。瑙鲁的亚伦是行政驻地，不应解读为该国拥有法定首都。

国外原始入选记录 519 条；联合国对科纳克里聚居区和首都使用不同编号，两条指向同一城市，因此合并为 518 条，并在 `selection.original_record_ids` 与 `un_city_codes` 保留证据。多中心聚居区可能含多个行政市，本文件不是全球行政城市总名录。

## 核心字段

| 字段 | 含义 |
|---|---|
| `id` | 本版本唯一标识；合并前编号见 selection |
| `name_zh` / `name_en` / `aliases` | 中文名、英文名、来源别名；中文译名存在不同习惯及简繁体形式 |
| `country` | 所属国家 ISO3 编码、中英文名称 |
| `longitude` / `latitude` | 经度 / 纬度，数值类型；东经、北纬为正 |
| `coordinate_reference_system` | WGS84，EPSG:4326，单位为十进制度 |
| `coordinate_role` / `coordinate_source` | 坐标代表点类型与来源，避免把人口重心当成市中心 |
| `selection` | 入选理由、参考年、聚居区人口、首都标记、UN 编号 |
| `description_zh` | 简要说明，删除读音、人口统计等冗余内容，部分为重新撰写 |
| `description_attribution` | 简述来源、编辑方式与文本许可 |
| `city_card` | 名片标题、照片说明、图片对象与选图方式 |
| `sources` / `quality_notes` | 参考来源和该条记录的具体限制 |

`population_ge_1m` 表示聚居区人口门槛，首都理由以原始 `reasons` 值为准；中国条目按行政层级入选，因此人口通常为 null。`admin_level` 只在原名录给出时填写，不从外国百科页面推断统一行政等级。`null` 表示未提供，不表示数值为零或已知不存在。

坐标保留 6 位小数仅为统一数据格式，不表示实地测量达到相应精度。796 条使用百科代表点，28 条使用 Wikidata 代表点；奥蒂特和克利普加特 2 条保留 UN 人口加权中心。坐标适合地图定位与检索，不应用于测绘或精确导航。

## 照片、许可和文字

全部名片引用真实照片，未使用 AI 生成图片。主要从百科首图和 Wikimedia Commons 选取；发现的人物误配、国旗和定位地图已替换。照片主题包括地标、街景、城市全景、公共建筑及当地教育活动；不能把每张都解释成城市唯一或最知名的地标。照片说明沿用来源语言并保留具体主体，便于 Agent 核验。

**本包存放图片 URL 和来源元数据，不包含图片二进制文件。** 读取 Agent 可按 `city_card.image.url` 获取原图，`preview_url` 为预览图；URL 可发生变化。本次检查了元数据和必填字段，没有对所有图片执行独立可用性检测，也没有逐张人工鉴赏。

822 条照片有来源标示的许可；4 条外部照片未说明作者与许可，标记为 `license_status: not_stated`，详见 validation。未知许可不能按免费可商用处理。每张图片应按自身许可履行署名、相同方式共享等要求；来源元数据保持原样的许可名称，不将整包许可套用到图片上。外部照片中 3 张已取得 HTTP 200 图像响应；`IND-WUP-10789` 的市政建筑照片及主体可由来源页面核对，但本地 Python 客户端未通过该站 TLS 证书链验证，自动获取可能失败，记录中已标注。

基于 Wikipedia 的文字为摘编和编辑，保留文章链接以便追溯贡献者，按 CC BY-SA 4.0 提供。自行撰写的简述也按此许可提供。事实字段与 UN 原始资料应分别查看其来源使用条款。图像作者与许可来自公开 API 元数据，不代表已取得额外授权。

## 来源

- 联合国 WUP 2025：[下载页面](https://population.un.org/wup/downloads?tab=Cities)；F20 首都表、F21 城市人口表。
- 中国大陆：[民政部行政区划代码](https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html)。
- 台湾城市：[行政院资料](https://www.ey.gov.tw/state/62879155A536D543/f3662cb7-5806-4755-8aba-ab1d44b97d7a)。
- 城市名称、代表点、简述与多数照片：每条 `sources`、`coordinate_source`、`description_attribution.source_page` 与 `city_card.image.source_page` 指向具体页面。

## 最小读取示例

```python
import json
with open("cities.jsonl", encoding="utf-8") as f:
    cities = [json.loads(line) for line in f if line.strip()]
paris = next(c for c in cities if c["id"] == "FRA-WUP-2994")
print(paris["longitude"], paris["latitude"], paris["city_card"]["image"]["url"])
```

文件生成日期：2026-10-01。数据版本：1.0；人口参考年：2025。
