import { Component, type ReactNode } from 'react'

export default class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) {
      return <div className="scene-fallback" role="alert">
        <p>地球场景加载失败，请检查应用资源或显卡驱动后重试。</p>
        <button type="button" onClick={() => window.location.reload()}>重新加载</button>
      </div>
    }
    return this.props.children
  }
}
