import { OMMQBackground } from './OMMQBackground'
import { Brand } from './Brand'

type BootScreenProps = {
  baseUrl: string
}

export function BootScreen({ baseUrl }: BootScreenProps) {
  return (
    <div className="boot-screen">
      <OMMQBackground />
      <div className="boot-orbit boot-orbit-one" />
      <div className="boot-orbit boot-orbit-two" />
      <div className="boot-core">
        <Brand subtitle="ESTABLISHING UPLINK" />
      </div>
      <div className="boot-status">
        <span className="boot-pulse" />
        <span>正在校准极光链路</span>
      </div>
      <code className="boot-endpoint">{baseUrl}</code>
    </div>
  )
}
