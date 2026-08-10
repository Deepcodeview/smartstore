import { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '../utils/api'
import BASE from '../utils/api'

const STATUS_COLOR = {
  queued:     { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  processing: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  completed:  { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  failed:     { bg: '#fff5f5', color: '#dc2626', border: '#fed7d7' },
}

const ZONE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444']
const ENTRY_COLOR = '#22c55e'
const EXIT_COLOR  = '#ef4444'
const DEFAULT_ZONE_NAMES = ['Zone A', 'Zone B', 'Zone C']

// ── Zone + Line Editor Canvas ─────────────────────────────────────────────────
function ZoneEditor({ frameUrl, videoWidth, videoHeight, onConfirm }) {
  const canvasRef    = useRef()
  const [tool,       setTool]       = useState('entry')  // 'entry' | 'exit' | 'zone'
  const [entryZone,  setEntryZone]  = useState(null)   // { points, closed }
  const [exitZone,   setExitZone]   = useState(null)   // { points, closed }
  const [zones,      setZones]      = useState([])
  const [activeZone, setActiveZone] = useState(null)   // index into zones[] or 'entry'/'exit'
  const [imgLoaded,  setImgLoaded]  = useState(false)
  const imgRef = useRef(new Image())

  // Load frame image
  useEffect(() => {
    imgRef.current.onload = () => setImgLoaded(true)
    imgRef.current.src = frameUrl
  }, [frameUrl])

  // Draw everything on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgLoaded) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(imgRef.current, 0, 0, W, H)

    // Helper: draw a polygon zone
    const drawPoly = (zone, color, label) => {
      if (!zone || zone.points.length < 1) return
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.fillStyle = color + '35'
      ctx.setLineDash(zone.closed ? [] : [6, 3])
      ctx.beginPath()
      ctx.moveTo(zone.points[0].x * W, zone.points[0].y * H)
      zone.points.forEach(p => ctx.lineTo(p.x * W, p.y * H))
      if (zone.closed) ctx.closePath()
      ctx.stroke()
      if (zone.closed) ctx.fill()
      ctx.setLineDash([])
      zone.points.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 5, 0, Math.PI * 2)
        ctx.fillStyle = color; ctx.fill()
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
      })
      if (zone.points.length >= 2) {
        const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length * W
        const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length * H
        ctx.fillStyle = color; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(label, cx, cy)
      }
    }

    // Draw regular zones
    zones.forEach((zone, zi) => {
      const color = ZONE_COLORS[zi % ZONE_COLORS.length]
      drawPoly(zone, color, zone.name)
    })

    // Draw entry zone (green)
    drawPoly(entryZone, ENTRY_COLOR, '⬡ ENTRY ZONE')
    // Draw exit zone (red)
    drawPoly(exitZone, EXIT_COLOR, '⬡ EXIT ZONE')
  }, [zones, entryZone, exitZone, imgLoaded])

  useEffect(() => { draw() }, [draw])

  const getRelPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top)  / rect.height,
    }
  }

  const handleCanvasClick = (e) => {
    const pos = getRelPos(e)

    const addPoint = (setter) => setter(prev =>
      prev ? { ...prev, points: [...prev.points, pos] } : { points: [pos], closed: false }
    )

    if (tool === 'entry') { addPoint(setEntryZone); return }
    if (tool === 'exit')  { addPoint(setExitZone);  return }
    if (tool === 'zone') {
      if (activeZone === null) {
        const idx  = zones.length
        const name = DEFAULT_ZONE_NAMES[idx] || `Zone ${idx + 1}`
        setZones(prev => [...prev, { name, points: [pos], closed: false }])
        setActiveZone(idx)
      } else {
        setZones(prev => prev.map((z, i) => i === activeZone
          ? { ...z, points: [...z.points, pos] } : z))
      }
    }
  }

  const closeZone = () => {
    if (tool === 'entry') { setEntryZone(prev => prev ? { ...prev, closed: true } : prev); return }
    if (tool === 'exit')  { setExitZone(prev  => prev ? { ...prev, closed: true } : prev); return }
    if (activeZone === null) return
    setZones(prev => prev.map((z, i) => i === activeZone ? { ...z, closed: true } : z))
    setActiveZone(null)
  }

  const removeZone = (idx) => {
    setZones(prev => prev.filter((_, i) => i !== idx))
    if (activeZone === idx) setActiveZone(null)
    else if (activeZone > idx) setActiveZone(activeZone - 1)
  }

  const resetAll = () => {
    setZones([]); setActiveZone(null)
    setEntryZone(null); setExitZone(null)
  }

  const handleConfirm = () => {
    const closedZones = zones.filter(z => z.closed && z.points.length >= 3)
    const zonesPayload = closedZones.map(z => ({
      name: z.name,
      points: z.points.map(p => [Math.round(p.x * 100), Math.round(p.y * 100)])
    }))
    const toPoints = (zone) => zone && zone.closed && zone.points.length >= 3
      ? zone.points.map(p => [Math.round(p.x * 100), Math.round(p.y * 100)])
      : []
    onConfirm({
      zones:      zonesPayload,
      entry_zone: toPoints(entryZone),
      exit_zone:  toPoints(exitZone),
    })
  }

  const isDrawing = (tool === 'entry' && entryZone && !entryZone.closed) ||
                    (tool === 'exit'  && exitZone  && !exitZone.closed)  ||
                    (tool === 'zone'  && activeZone !== null)
  const canConfirm = (entryZone?.closed || exitZone?.closed || zones.some(z => z.closed))

  return (
    <div className="zone-editor">
      {/* Toolbar */}
      <div className="zone-toolbar">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className={`tool-btn ${tool === 'entry' ? 'active' : ''}`}
            onClick={() => setTool('entry')}
            style={{ borderColor: tool === 'entry' ? '#22c55e' : '', color: tool === 'entry' ? '#16a34a' : '', background: tool === 'entry' ? '#f0fdf4' : '' }}>
            ⬡ Entry Zone
          </button>
          <button className={`tool-btn ${tool === 'exit' ? 'active' : ''}`}
            onClick={() => setTool('exit')}
            style={{ borderColor: tool === 'exit' ? '#ef4444' : '', color: tool === 'exit' ? '#dc2626' : '', background: tool === 'exit' ? '#fff5f5' : '' }}>
            ⬡ Exit Zone
          </button>
          <button className={`tool-btn ${tool === 'zone' ? 'active' : ''}`}
            onClick={() => setTool('zone')} disabled={zones.length >= 5}>
            ⬡ Draw Zone
          </button>
          {isDrawing && (
            <button className="tool-btn done" onClick={closeZone}>✓ Close Zone</button>
          )}
          <button className="tool-btn reset" onClick={resetAll}>↺ Reset</button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="text-xs text-muted">
            {isDrawing ? 'Points click karo, phir "Close Zone" karo' : 'Tool select karo aur canvas pe click karo'}
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            ▶ Process Karo
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          onClick={handleCanvasClick}
          style={{
            width: '100%',
            cursor: 'crosshair',
            borderRadius: '0 0 12px 12px',
            display: 'block',
          }}
        />
        {!imgLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e14', borderRadius: '0 0 12px 12px' }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        )}
      </div>

      {/* Zone + Entry/Exit chips */}
      {(zones.length > 0 || entryZone || exitZone) && (
        <div className="zone-list">
          {entryZone && (
            <div className="zone-chip" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div className="zone-chip-dot" style={{ background: ENTRY_COLOR }} />
              <span className="text-xs" style={{ color: '#16a34a', fontWeight: 600 }}>Entry Zone</span>
              <span className="text-xs text-muted">{entryZone.points.length} pts</span>
              {entryZone.closed
                ? <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Closed</span>
                : <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>Drawing...</span>}
              <button onClick={() => setEntryZone(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 14 }}>✕</button>
            </div>
          )}
          {exitZone && (
            <div className="zone-chip" style={{ background: '#fff5f5', border: '1px solid #fed7d7' }}>
              <div className="zone-chip-dot" style={{ background: EXIT_COLOR }} />
              <span className="text-xs" style={{ color: '#dc2626', fontWeight: 600 }}>Exit Zone</span>
              <span className="text-xs text-muted">{exitZone.points.length} pts</span>
              {exitZone.closed
                ? <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Closed</span>
                : <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>Drawing...</span>}
              <button onClick={() => setExitZone(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 14 }}>✕</button>
            </div>
          )}
          {zones.map((zone, i) => (
            <div key={i} className="zone-chip">
              <div className="zone-chip-dot" style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }} />
              <input
                className="zone-name-input"
                value={zone.name}
                onChange={e => setZones(prev => prev.map((z, zi) => zi === i ? { ...z, name: e.target.value } : z))}
              />
              <span className="text-xs text-muted">{zone.points.length} pts</span>
              {zone.closed
                ? <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Closed</span>
                : <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>Drawing...</span>
              }
              <button onClick={() => removeZone(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 14 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {!entryZone && !exitZone && zones.length === 0 && (
        <div style={{ padding: '12px 16px', background: '#eff6ff', borderTop: '1px solid #bfdbfe', fontSize: 12, color: '#1e40af' }}>
          💡 <strong>Entry Zone (green)</strong> — jahan se log andar aate hain &nbsp;|&nbsp; <strong>Exit Zone (red)</strong> — jahan se log bahar jaate hain &nbsp;|&nbsp; <strong>Zone</strong> — store ke sections
        </div>
      )}
    </div>
  )
}

// ── Processing View ───────────────────────────────────────────────────────────
function ProcessingView({ job, onViewAnalytics, onClose }) {
  const isProcessing = job.status === 'queued' || job.status === 'processing'
  const isCompleted  = job.status === 'completed'
  const isFailed     = job.status === 'failed'

  const steps = [
    { label: 'Upload',     done: true },
    { label: 'Configure',  done: job.status !== 'queued' },
    { label: 'Processing', done: isCompleted || isFailed },
    { label: 'Done',       done: isCompleted },
  ]

  return (
    <div className="processing-view">
      <div className="processing-header">
        <div>
          <div className="processing-filename">🎬 {job.filename}</div>
          <div className="text-xs text-muted cell-mono">{job.job_id}</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
      </div>

      {/* Pipeline */}
      <div className="pipeline">
        {steps.map((step, i) => (
          <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
            <div className={`pipeline-step ${step.done ? 'done' : isProcessing && i === steps.findIndex(s => !s.done) ? 'active' : ''}`}>
              <div className="pipeline-dot">
                {step.done ? '✓' : isProcessing && i === steps.findIndex(s => !s.done)
                  ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                  : i + 1}
              </div>
              <div className="pipeline-label">{step.label}</div>
            </div>
            {i < steps.length - 1 && <div className={`pipeline-line ${step.done ? 'done' : ''}`} />}
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="processing-progress-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="text-sm" style={{ fontWeight: 600 }}>
            {isFailed ? '❌ Failed' : isCompleted ? '✅ Complete' : `⚙️ Processing... ${job.progress}%`}
          </span>
          <span className="text-sm text-muted">{job.progress}%</span>
        </div>
        <div className="progress-bar" style={{ height: 10, borderRadius: 6 }}>
          <div className="progress-fill" style={{
            width: `${job.progress}%`,
            background: isFailed ? 'var(--red)' : isCompleted ? 'var(--green)' : 'var(--brand)',
            borderRadius: 6, transition: 'width 0.5s ease',
          }} />
        </div>
        {isProcessing && (
          <div className="text-xs text-muted" style={{ marginTop: 6 }}>
            🔄 AI model video analyze kar raha hai — person detection, tracking, zone analysis...
          </div>
        )}
      </div>

      {/* Live stream feed */}
      {isProcessing && (
        <div style={{ marginTop: 16 }}>
          <div className="completed-section">
            <div className="video-player-wrap">
              <div className="video-player-label">🔴 Live Feed — AI Processing ({job.progress}%)</div>
              <img
                style={{ width: '100%', borderRadius: '0 0 12px 12px', background: '#000', maxHeight: 400, objectFit: 'contain' }}
                src={`${BASE}/jobs/${job.job_id}/stream`}
                alt="Live Processing Stream"
              />
            </div>
          </div>
        </div>
      )}


      {/* Completed video player */}
      {isCompleted && (
        <div className="completed-section">
          <div className="video-player-wrap">
            <div className="video-player-label">🎬 Annotated Video — AI processed output</div>
            <video
              controls autoPlay
              style={{ width: '100%', borderRadius: '0 0 12px 12px', background: '#000', maxHeight: 400 }}
              src={`${BASE}/jobs/${job.job_id}/video`}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={onViewAnalytics}>
              📊 Full Analytics Dekho
            </button>
            <a href={`${BASE}/jobs/${job.job_id}/video`} download className="btn btn-secondary">
              ⬇ Download
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Jobs Page ─────────────────────────────────────────────────────────────
export default function Jobs({ onSelectJob, selectedJobId, jobs, onRefresh }) {
  const [sourceType,   setSourceType]   = useState('file')  // 'file' | 'camera'
  const [cameraSource, setCameraSource] = useState('0')
  const [uploading,   setUploading]   = useState(false)
  const [uploadMsg,   setUploadMsg]   = useState('')
  const [dragOver,    setDragOver]    = useState(false)
  const [activeJobId, setActiveJobId] = useState(null)
  const [stage,       setStage]       = useState('list')  // 'list' | 'configure' | 'processing'
  const [frameUrl,    setFrameUrl]    = useState(null)
  const [videoMeta,   setVideoMeta]   = useState({ width: 1280, height: 720 })
  const fileRef = useRef()

  const activeJob = jobs.find(j => j.job_id === activeJobId) || null

  // When job transitions to processing/completed, switch stage
  useEffect(() => {
    if (!activeJob) return
    if (activeJob.status === 'processing' || activeJob.status === 'completed' || activeJob.status === 'failed') {
      if (stage !== 'processing') setStage('processing')
    }
  }, [activeJob?.status])

  const handleUpload = async (file) => {
    if (!file) return
    const allowed = ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    if (!allowed.some(ext => file.name.toLowerCase().endsWith(ext))) {
      setUploadMsg('❌ Sirf MP4, AVI, MOV, MKV, WebM allowed hai')
      return
    }
    setUploading(true)
    setUploadMsg('')
    const form = new FormData()
    form.append('file', file)
    try {
      const data = await api.post('/upload-video/', form)
      if (data.job_id) {
        setActiveJobId(data.job_id)
        setUploadMsg('')
        onRefresh()
        if (fileRef.current) fileRef.current.value = ''
        // Load first frame for zone editor
        setFrameUrl(`${BASE}/jobs/${data.job_id}/frame`)
        setStage('configure')
      } else {
        setUploadMsg(`❌ ${data.detail || 'Upload failed'}`)
      }
    } catch {
      setUploadMsg('❌ Backend se connect nahi ho paya')
    }
    setUploading(false)
  }

  const handleConnectCamera = async () => {
    setUploading(true)
    setUploadMsg('')
    const form = new FormData()
    form.append('camera_source', cameraSource)
    try {
      const res = await fetch(`${BASE}/jobs/camera/preview-frame`, { method: 'POST', body: form })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setFrameUrl(url)
      setActiveJobId('camera_temp')
      setStage('configure')
    } catch {
      setUploadMsg('❌ Camera connect nahi ho paya. Port/Source check karo.')
    }
    setUploading(false)
  }

  const handleStartProcessing = async ({ zones, entry_zone, exit_zone }) => {
    if (!activeJobId) return
    const form = new FormData()
    form.append('zones',      JSON.stringify(zones))
    form.append('entry_zone', JSON.stringify(entry_zone))
    form.append('exit_zone',  JSON.stringify(exit_zone))
    form.append('conf',       '0.35')
    try {
      if (activeJobId === 'camera_temp') {
        form.append('camera_source', cameraSource)
        const data = await api.post('/jobs/camera/start', form)
        if (data.job_id) {
          setActiveJobId(data.job_id)
          onRefresh()
          setStage('processing')
        } else {
          alert('Camera stream start nahi ho paya.')
        }
      } else {
        await fetch(`${BASE}/jobs/${activeJobId}/start`, { method: 'POST', body: form })
        onRefresh()
        setStage('processing')
      }
    } catch {
      alert('Processing start nahi ho paya. Backend check karo.')
    }
  }

  const handleDelete = async (e, jobId) => {
    e.stopPropagation()
    if (activeJobId === jobId) { setActiveJobId(null); setStage('list') }
    await api.delete(`/jobs/${jobId}`)
    onRefresh()
  }

  const handleSelectExisting = (jobId) => {
    setActiveJobId(jobId)
    const job = jobs.find(j => j.job_id === jobId)
    if (job?.status === 'queued') {
      setFrameUrl(`${BASE}/jobs/${jobId}/frame`)
      setStage('configure')
    } else {
      setStage('processing')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    handleUpload(e.dataTransfer.files[0])
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">📹 Video Processing</h1>
          <p className="page-subtitle">Video upload karo, zones set karo, phir AI process karega</p>
        </div>
        <div className="stat-pill">{jobs.length} Total Jobs</div>
      </div>

      <div className="jobs-layout">
        {/* Left — Upload + Job List */}
        <div className="jobs-left">
          {/* Source Type Toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              className={`btn ${sourceType === 'file' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
              onClick={() => { setSourceType('file'); setStage('list'); setActiveJobId(null); setFrameUrl(null) }}
            >
              📁 Video File Upload
            </button>
            <button
              className={`btn ${sourceType === 'camera' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
              onClick={() => { setSourceType('camera'); setStage('list'); setActiveJobId(null); setFrameUrl(null) }}
            >
              📷 Live Camera Connect
            </button>
          </div>

          {sourceType === 'file' ? (
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".mp4,.avi,.mov,.mkv,.webm"
                style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0])} />
              <div className="upload-icon">{uploading ? '⏳' : '🎬'}</div>
              <div className="upload-title">{uploading ? 'Uploading...' : 'Video drag karo ya click karo'}</div>
              <div className="upload-sub">MP4 · AVI · MOV · MKV · WebM</div>
              {uploadMsg && <div className={`upload-msg ${uploadMsg.startsWith('✅') ? 'success' : 'error'}`}>{uploadMsg}</div>}
            </div>
          ) : (
            <div className="card" style={{ padding: '16px 20px', border: '1.5px solid var(--border)', borderRadius: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>📷 Connect Live Camera (Webcam / RTSP)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Camera Source / URL</label>
                  <input
                    type="text"
                    value={cameraSource}
                    onChange={e => setCameraSource(e.target.value)}
                    placeholder='0 (default webcam) ya RTSP/OAK source'
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', outline: 'none', fontSize: 13 }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => setCameraSource('0')}
                    >
                      🔌 Default Webcam (0)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => setCameraSource('oak')}
                    >
                      🎥 OAK Camera (DepthAI)
                    </button>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleConnectCamera}
                  disabled={uploading}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {uploading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : '🔌'}
                  {uploading ? 'Connecting...' : 'Connect & Preview Camera'}
                </button>
                {uploadMsg && <div className="upload-msg error" style={{ fontSize: 12, marginTop: 4 }}>{uploadMsg}</div>}
              </div>
            </div>
          )}


          {jobs.length > 0 && (
            <div className="card">
              <div className="card-header"><div className="card-title">All Jobs</div></div>
              <div style={{ padding: '8px 0' }}>
                {jobs.map(job => {
                  const sc = STATUS_COLOR[job.status] || STATUS_COLOR.queued
                  const isActive = activeJobId === job.job_id
                  return (
                    <div key={job.job_id} className={`job-list-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectExisting(job.job_id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.filename}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span className="badge" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: 10 }}>
                            {job.status === 'processing' && <span className="spinner" style={{ width: 8, height: 8, borderWidth: 1.5 }} />}
                            {job.status}
                          </span>
                          <span className="text-xs text-muted">{job.progress}%</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <div className="progress-bar" style={{ width: 50 }}>
                          <div className="progress-fill" style={{
                            width: `${job.progress}%`,
                            background: job.status === 'failed' ? 'var(--red)' : job.status === 'completed' ? 'var(--green)' : 'var(--brand)'
                          }} />
                        </div>
                        <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={e => handleDelete(e, job.job_id)}>🗑</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="jobs-right">
          {stage === 'list' && (
            <div className="empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="empty-state-icon">⬅️</div>
              <div className="empty-state-title">Video upload karo</div>
              <p className="text-muted text-sm">Upload ke baad zones aur line set kar sakte ho</p>
            </div>
          )}

          {stage === 'configure' && frameUrl && (
            <div>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  🗺️ Zones & Entry/Exit Line Configure Karo
                </div>
                <div className="text-xs text-muted">
                  Canvas pe zones draw karo aur entry/exit line set karo, phir "Process Karo" click karo
                </div>
              </div>
              <ZoneEditor
                frameUrl={frameUrl}
                videoWidth={videoMeta.width}
                videoHeight={videoMeta.height}
                onConfirm={handleStartProcessing}
              />
            </div>
          )}

          {stage === 'processing' && activeJob && (
            <ProcessingView
              job={activeJob}
              onViewAnalytics={() => onSelectJob(activeJob.job_id)}
              onClose={() => { setActiveJobId(null); setStage('list') }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
