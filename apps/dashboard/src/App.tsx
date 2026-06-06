import { useEffect, useState } from 'react'
import {
  api, getToken, setToken, clearToken,
  type Issue, type IssueDetail, type Persona, type ChannelSignal, type Brief, type Frame,
} from './api.js'

export default function App() {
  const [authed, setAuthed] = useState(!!getToken())
  const [selected, setSelected] = useState<string | null>(null)

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  return (
    <>
      <div className="topbar">
        <h1>PoliReports <span className="tag">People Intelligence Engine · dummy-data mode</span></h1>
        <button className="btn ghost" onClick={() => { clearToken(); setAuthed(false); setSelected(null) }}>Sign out</button>
      </div>
      <div className="container">
        {selected
          ? <IssueDetailView id={selected} onBack={() => setSelected(null)} />
          : <IssuesList onSelect={setSelected} />}
      </div>
    </>
  )
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('admin@polireports.local')
  const [password, setPassword] = useState('DevAdminPass123!')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const { token } = await api.login(email, password)
      setToken(token)
      onLogin()
    } catch {
      setErr('Invalid credentials')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="card">
        <h2>PoliReports</h2>
        <p className="muted">Sign in to the intelligence dashboard.</p>
        <form onSubmit={submit}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <div style={{ marginTop: 16 }}>
            <button className="btn" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
          {err && <div className="error">{err}</div>}
        </form>
        <p className="muted mono" style={{ marginTop: 16, fontSize: 12 }}>
          Demo: admin@polireports.local / DevAdminPass123!
        </p>
      </div>
    </div>
  )
}

function IssuesList({ onSelect }: { onSelect: (id: string) => void }) {
  const [issues, setIssues] = useState<Issue[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => { api.issues().then(setIssues).catch((e) => setErr(String(e.message))) }, [])

  if (err) return <div className="card error">Failed to load: {err}</div>
  if (!issues) return <div className="card muted">Loading issues…</div>

  return (
    <div className="card">
      <h2>Emerging Issues</h2>
      <p className="muted">Ranked by momentum. Thin-data issues are activation-blocked until corroborated.</p>
      <table>
        <thead>
          <tr><th>Issue</th><th>Status</th><th>Momentum</th><th>24h Δ</th><th>Sources</th><th>Confidence</th><th></th></tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr key={i.id} className="clickable" onClick={() => onSelect(i.id)}>
              <td>
                <div>{i.label}</div>
                <div className="muted mono" style={{ fontSize: 12 }}>{i.primaryState} · {i.slug}</div>
              </td>
              <td><span className={`badge ${i.status}`}>{i.status}</span></td>
              <td className="mono">{Number(i.momentumScore).toFixed(2)}</td>
              <td className="mono" style={{ color: (i.momentumDelta24h ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {(i.momentumDelta24h ?? 0) >= 0 ? '+' : ''}{Number(i.momentumDelta24h ?? 0).toFixed(2)}
              </td>
              <td className="mono">{i.totalSourceUnits}</td>
              <td>
                {i.activationBlocked
                  ? <span className="badge blocked">blocked</span>
                  : <span className={`badge ${i.confidence}`}>{i.confidence}</span>}
              </td>
              <td className="muted">→</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IssueDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<IssueDetail | null>(null)
  const [err, setErr] = useState('')

  const load = () => api.detail(id).then(setData).catch((e) => setErr(String(e.message)))
  useEffect(() => { load() }, [id])

  if (err) return <div className="card error">Failed to load: {err}</div>
  if (!data) return <div className="card muted">Loading detail…</div>

  const { issue, personas, channels, briefs, frames } = data

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost" onClick={onBack}>← All issues</button>
      </div>

      <div className="card">
        <div className="row">
          <h2>{issue.label}</h2>
          <span className={`badge ${issue.status}`}>{issue.status}</span>
          {issue.activationBlocked && <span className="badge blocked">activation blocked</span>}
        </div>
        <p className="muted">{issue.description}</p>
        <div className="grid cols-2" style={{ marginTop: 8 }}>
          <div>
            <div className="kv"><span className="k">Momentum</span><span className="mono">{Number(issue.momentumScore).toFixed(2)}</span></div>
            <div className="kv"><span className="k">Source units</span><span className="mono">{issue.totalSourceUnits}</span></div>
            <div className="kv"><span className="k">Cross-platform</span><span className="mono">{issue.crossPlatformCount}</span></div>
          </div>
          <div>
            <div className="kv"><span className="k">Geo</span><span>{issue.geoScope} · {issue.primaryState}</span></div>
            <div className="kv"><span className="k">Data confidence</span><span className={`badge ${issue.confidence}`}>{issue.confidence}</span></div>
            <div className="kv"><span className="k">Themes</span><span className="row">{(issue.themes ?? []).map((t) => <span key={t} className="chip">{t}</span>)}</span></div>
          </div>
        </div>
        {issue.activationBlocked && (
          <div className="warn" style={{ marginTop: 12 }}>
            ⚠ Thin data ({issue.totalSourceUnits} source units, under 50-unit threshold). Insights are directional only — do not activate.
          </div>
        )}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Audience Personas ({personas.length})</h3>
          {personas.length === 0 && <p className="muted">No personas (thin data).</p>}
          {personas.map((p) => <PersonaCard key={p.id} p={p} />)}
        </div>

        <div className="card">
          <h3>Top Channels — Comment Vitality ({channels.length})</h3>
          {channels.length === 0 && <p className="muted">No ranked channels.</p>}
          <table>
            <thead><tr><th>Channel</th><th>CVS</th><th>Stance</th><th>Comments</th></tr></thead>
            <tbody>
              {channels.map((c) => <ChannelRow key={c.id} c={c} />)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Framing Reframes ({frames.length})</h3>
        {frames.map((f) => <FrameCard key={f.id} f={f} />)}
      </div>

      <GenerateBrief issueId={id} onDone={load} />

      <div className="card">
        <h3>Bridge Briefs ({briefs.length})</h3>
        {briefs.length === 0 && <p className="muted">No briefs yet — generate one above.</p>}
        {briefs.map((b) => <BriefCard key={b.id} b={b} />)}
      </div>
    </>
  )
}

function PersonaCard({ p }: { p: Persona }) {
  return (
    <div className="card" style={{ background: 'var(--panel2)' }}>
      <div className="row">
        <strong>{p.label}</strong>
        <span className={`badge ${p.confidence}`}>{p.confidence}</span>
      </div>
      <div className="kv"><span className="k">Cohort size</span><span className="mono">{p.sourceUnitCount}</span></div>
      <div className="kv"><span className="k">Demographics</span><span>{p.ageSkew} · {p.urbanRuralSkew} · {p.incomeProxySkew}</span></div>
      <div className="kv"><span className="k">Primary moral foundation</span><span className="chip">{p.mftPrimary}</span></div>
      <div className="kv"><span className="k">Stance</span><span>{p.stanceOnIssue} · persuadability {Number(p.persuadabilityScore ?? 0).toFixed(2)}</span></div>
      <div className="kv"><span className="k">Receptive frames</span><span className="row">{(p.receptiveFrames ?? []).map((x) => <span key={x} className="chip">{x}</span>)}</span></div>
      <div className="kv"><span className="k">Resonant vocab</span><span className="muted">{(p.resonantVocabulary ?? []).join(', ')}</span></div>
    </div>
  )
}

function ChannelRow({ c }: { c: ChannelSignal }) {
  return (
    <tr>
      <td>
        <div>{c.channel.displayName}</div>
        <div className="muted mono" style={{ fontSize: 12 }}>{c.channel.platform} · {Intl.NumberFormat().format(c.channel.subscriberProxy)} subs</div>
      </td>
      <td>
        <div className="mono">{Number(c.cvsForIssue).toFixed(0)}</div>
        <div className="bar" style={{ width: 60 }}><span style={{ width: `${c.cvsForIssue}%` }} /></div>
      </td>
      <td><span className="badge muted">{c.stance}</span></td>
      <td className="mono">{Intl.NumberFormat().format(c.commentCount ?? 0)}</td>
    </tr>
  )
}

function FrameCard({ f }: { f: Frame }) {
  return (
    <div className="card" style={{ background: 'var(--panel2)' }}>
      <div className="row">
        <strong>{f.segment}</strong>
        <span className="chip">targets: {f.foundationTargeted}</span>
        <span className={`badge ${f.fidelityVerified ? 'high' : 'low'}`}>fidelity {Number(f.fidelityScore ?? 0).toFixed(2)}{f.fidelityVerified ? ' ✓' : ''}</span>
      </div>
      <p style={{ margin: '8px 0' }}>{f.reframeText}</p>
      <div className="row">{(f.vocabDistinctive ?? []).map((v) => <span key={v} className="chip">{v}</span>)}</div>
    </div>
  )
}

function BriefCard({ b }: { b: Brief }) {
  return (
    <div className="card" style={{ background: 'var(--panel2)' }}>
      <div className="row">
        <strong>{b.headline}</strong>
        <span className={`badge ${b.overallConfidence}`}>{b.overallConfidence} ({Number(b.confidenceScore).toFixed(2)})</span>
      </div>
      <p style={{ margin: '8px 0' }}>{b.executiveSummary}</p>
      <p className="muted" style={{ fontSize: 13 }}>{b.confidenceStatement}</p>
      {(b.thinDataWarnings ?? []).length > 0 && (
        <div className="warn">{b.thinDataWarnings!.join(' · ')}</div>
      )}
    </div>
  )
}

function GenerateBrief({ issueId, onDone }: { issueId: string; onDone: () => void }) {
  const [position, setPosition] = useState('')
  const [principle, setPrinciple] = useState('')
  const [segment, setSegment] = useState('persuadable independents')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg('')
    try {
      await api.generateBrief({ issueId, position, principle, targetSegment: segment })
      setMsg('Brief queued — generating…')
      // Worker is async; poll the detail a couple times.
      setTimeout(async () => { await onDone(); setMsg('Brief ready ↓'); setBusy(false) }, 2500)
    } catch (e: any) {
      setMsg(`Error: ${e.message}`); setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>Generate a Bridge Brief</h3>
      <p className="muted">State your position and the principle you won't compromise. The language engine produces a cross-partisan reframe.</p>
      <form onSubmit={submit}>
        <div className="grid cols-2">
          <div>
            <label>Your position</label>
            <textarea rows={2} value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. We support a balanced solar siting ordinance" required minLength={10} />
          </div>
          <div>
            <label>Principle to preserve</label>
            <textarea rows={2} value={principle} onChange={(e) => setPrinciple(e.target.value)} placeholder="e.g. Protect productive farmland while enabling clean energy" required minLength={10} />
          </div>
        </div>
        <label>Target segment</label>
        <select value={segment} onChange={(e) => setSegment(e.target.value)}>
          <option>persuadable independents</option>
          <option>cost-conscious moderates</option>
          <option>civic-minded conservatives</option>
          <option>pragmatic progressives</option>
        </select>
        <div style={{ marginTop: 14 }} className="row">
          <button className="btn" disabled={busy} type="submit">{busy ? 'Generating…' : 'Generate brief'}</button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      </form>
    </div>
  )
}
