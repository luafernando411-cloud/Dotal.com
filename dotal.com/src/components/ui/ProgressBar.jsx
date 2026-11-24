export function ProgressBar({ current, total, label }) {
  const percent = total ? Math.round((current / total) * 100) : 0
  return (
    <div className="progress-area" data-testid="census-progress">
      <div className="progress-meta"><span>{label || `ETAPA ${current} DE ${total}`}</span><strong>{percent}%</strong></div>
      <div className="progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div>
    </div>
  )
}
