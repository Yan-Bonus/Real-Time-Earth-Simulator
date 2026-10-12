import type { SceneDiagnostics } from '../scene/RotatingEarth'

export default function DiagnosticsPanel({ value }: { value: SceneDiagnostics | null }) {
  if (!value) return <p className="diagnostics">正在采集渲染信息…</p>
  return <div className="diagnostics" data-testid="diagnostics" data-angle={value.angleDegrees} data-camera-distance={value.cameraDistance} data-epoch={value.epoch} data-longitude={value.longitude} data-latitude={value.latitude}>
    <dl>
      <dt>自转角</dt><dd>{value.angleDegrees.toFixed(4)}°</dd>
      <dt>儒略日（UTC）</dt><dd>{value.julianDate.toFixed(5)}</dd>
      <dt>相机距离</dt><dd>{value.cameraDistance.toFixed(3)} R</dd>
      <dt>纹理尺寸上限</dt><dd>{value.resolution}</dd>
      <dt>像素比</dt><dd>{value.pixelRatio.toFixed(2)}</dd>
      <dt>绘制频率</dt><dd>{value.renderHz.toFixed(1)} 次/秒</dd>
      <dt>绘制调用 / 三角形</dt><dd>{value.drawCalls} / {value.triangles.toLocaleString('zh-CN')}</dd>
      <dt>纹理 / 几何</dt><dd>{value.textures} / {value.geometries}</dd>
    </dl>
    <p>UTC 近似 UT1 · 未校正极移<br />按需绘制，静止时降低刷新频率</p>
  </div>
}
