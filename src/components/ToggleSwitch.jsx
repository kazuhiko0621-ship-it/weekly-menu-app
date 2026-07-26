// シンプルなオン/オフトグルスイッチ
export default function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`toggle-switch${checked ? ' on' : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-track">
        <span className="toggle-knob" />
      </span>
      {label && <span className="toggle-label">{label}</span>}
    </button>
  )
}
