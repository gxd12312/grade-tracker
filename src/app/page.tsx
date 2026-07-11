'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const AI_NAME = process.env.NEXT_PUBLIC_AI_NAME || 'AI';

interface Student { id: string; name: string; grade?: string | null; school?: string | null; }
interface Question { id: string; number: string; content?: string | null; score: number; maxScore: number; isCorrect: boolean; knowledgePoint?: string | null; suggestion?: string | null; }
interface Exam { id: string; name: string; subject: string; totalScore: number; maxScore: number; examDate: string; semester?: string | null; analysis?: string | null; rawResponse?: string | null; student: { name: string; grade?: string | null; school?: string | null }; questions: Question[]; }
interface Settings { apiKey: string; baseURL: string; model: string; }

const DEFAULT_SETTINGS: Settings = { apiKey: '', baseURL: '', model: 'gpt-4o' };

function loadSettings(): Settings {
  try { const raw = localStorage.getItem('ai_settings'); if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; } catch {}
  return DEFAULT_SETTINGS;
}

function pct(num: number, max: number) { return max > 0 ? Math.round((num / max) * 100) : 0; }
function color(v: number) { return v >= 80 ? '#34c759' : v >= 60 ? '#ff9f0a' : '#ff3b30'; }
function prog(v: number) { return v >= 80 ? 'bg-green' : v >= 60 ? 'bg-amber' : 'bg-red'; }

export default function Home() {
  const [tab, setTab] = useState<'overview' | 'upload' | 'history'>('overview');
  const [students, setStudents] = useState<Student[]>([]);  const [exams, setExams] = useState<Exam[]>([]);
  const [selStudent, setSelStudent] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState('');  const [newSchool, setNewSchool] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selExam, setSelExam] = useState<Exam | null>(null);
  const [stats, setStats] = useState({ total: 0, avg: 0, mistakes: 0 });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [sitePw, setSitePw] = useState('');
  const [authed, setAuthed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [uploadOK, setUploadOK] = useState(false);
  const [examName, setExamName] = useState('');  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSettings(loadSettings());    setSitePw(localStorage.getItem('site_password') || '');
  }, []);

  const authH = (): Record<string, string> => {
    const h: Record<string, string> = {};    const sp = localStorage.getItem('site_password');
    if (sp) h['x-site-auth'] = sp;
    return h;
  };

  const apiErr = async (r: Response) => {
    if (r.status === 401) { setAuthed(false); setError('链被授权，请在设置中设置密码'); return true; }
    return false;
  };

  const load = useCallback(async () => {
    try {
      const [sr, er] = await Promise.all([fetch('/api/students', { headers: authH() }), fetch('/api/exams', { headers: authH() })]);
      if (await apiErr(sr) || await apiErr(er)) return;
      const sd = await sr.json(); setStudents(sd);
      const ed = await er.json(); setExams(ed);
      if (ed.length > 0) {
        const t = ed.reduce((s: number, e: Exam) => s + e.totalScore, 0);        const m = ed.reduce((s: number, e: Exam) => s + e.maxScore, 0);
        const mk = ed.reduce((s: number, e: Exam) => s + e.questions.filter(q => !q.isCorrect).length, 0);
        setStats({ total: ed.length, avg: m > 0 ? Math.round((t / m) * 100) : 0, mistakes: mk });
      }
    } catch (e) { console.error('load', e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addStudent = async () => {
    if (!newName.trim()) return;
    try {
      const r = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authH() }, body: JSON.stringify({ name: newName, grade: newGrade, school: newSchool }) });
      if (await apiErr(r)) return;
      const s = await r.json();
      if (s.id) { setStudents([s, ...students]); setSelStudent(s.id); setNewName(''); setNewGrade(''); setNewSchool(''); setShowAddStudent(false); }
    } catch { setError('添加失败'); }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {    const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setError(''); setUploadOK(false); }
  };

  const doUpload = async () => {
    if (!file || !selStudent) { setError('请选择学生和试卷'); return; }
    if (!settings.apiKey) { setError('请先在右上角设置 API Key'); return; }
    setUploading(true); setError(''); setUploadOK(false);
    try {
      const fd = new FormData();      fd.append('file', file); fd.append('studentId', selStudent); fd.append('name', examName);
      const h: Record<string, string> = {};
      if (settings.apiKey) h['x-api-key'] = settings.apiKey;
      if (settings.baseURL) h['x-base-url'] = settings.baseURL;
      if (settings.model) h['x-model'] = settings.model;      const r = await fetch('/api/parse', { method: 'POST', body: fd, headers: { ...h, ...authH() } });
      if (await apiErr(r)) { setUploading(false); return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '解析失败');
      setFile(null); setPreview(null); setUploadOK(true); setExamName('');      await load();
    } catch (e: any) { setError(e.message || '上传失败'); }    finally { setUploading(false); }
  };

  const delExam = async (id: string) => {
    if (!confirm('确定删除？')) return;
    try { const r = await fetch('/api/exams/' + id, { method: 'DELETE', headers: authH() }); if (await apiErr(r)) return; if (selExam?.id === id) setSelExam(null); await load(); }
    catch { setError('删除失败'); }
  };

  const saveSettings = () => { localStorage.setItem('ai_settings', JSON.stringify(settings)); if (sitePw) localStorage.setItem('site_password', sitePw); setShowSettings(false); };

  return (
    <>      {/* Global Nav */}
      <nav className="nav-global">
        <div className="nav-inner">          <span className="nav-brand">{students.length > 0 && selStudent ? students.find(s => s.id === selStudent)?.name + ' 的成绩记录' : '成绩记录'}</span>          <button onClick={() => setShowSettings(!showSettings)} className="icon-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a1a1a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </nav>

      {/* Settings */}      {showSettings && (
        <div className="settings-panel fade-in">
          <div className="container-sm">
            <h2 className="display-lg" style={{ fontSize: 24, marginBottom: 24 }}>设置</h2>
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <label className="form-label">API Key <span style={{ color: '#ff3b30' }}>*</span></label>
                <input type="password" placeholder="sk-..." value={settings.apiKey} onChange={e => setSettings({ ...settings, apiKey: e.target.value })} className="input" />
              </div>
              <div className="grid-2">
                <div>
                  <label className="form-label">Base URL</label>
                  <input type="text" placeholder="https://api.deepseek.com/v1" value={settings.baseURL} onChange={e => setSettings({ ...settings, baseURL: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="form-label">Model</label>
                  <input type="text" placeholder="gpt-4o" value={settings.model} onChange={e => setSettings({ ...settings, model: e.target.value })} className="input" />                </div>
              </div>
              <div className="divider-top">
                <label className="form-label">访问密码（可选）</label>
                <input type="password" placeholder="留空则无需密码" value={sitePw} onChange={e => setSitePw(e.target.value)} className="input" />
                <p className="fine-print" style={{ marginTop: 6 }}>设置后所有写操作需要验证</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={saveSettings} className="btn-blue">保存</button>
                <button onClick={() => setShowSettings(false)} className="btn-secondary">取消</button>              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-friendly nav wrapper */}
      <div className="content-wrapper">
        {/* Hero - parchment */}
        <section className="tile tile-parchment">
          <div className="container-sm" style={{ textAlign: 'center' }}>
            <StudentSwitcher students={students} selId={selStudent} onSelect={setSelStudent} onAdd={() => setShowAddStudent(true)} />
            {showAddStudent && (
              <div className="card-store fade-in" style={{ marginTop: 16, display: 'grid', gap: 12, textAlign: 'left' }}>
                <input placeholder="姓名" value={newName} onChange={e => setNewName(e.target.value)} className="input" />
                <div className="grid-2">
                  <input placeholder="年级" value={newGrade} onChange={e => setNewGrade(e.target.value)} className="input" />
                  <input placeholder="学校（可选）" value={newSchool} onChange={e => setNewSchool(e.target.value)} className="input" />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={addStudent} className="btn-blue">确认添加</button>
                  <button onClick={() => setShowAddStudent(false)} className="btn-secondary">取消</button>
                </div>
              </div>
            )}
            <Insights exams={exams} stats={stats} />          </div>
        </section>

        {/* Sub-nav */}
        <nav className="subnav-sticky">
          <div className="container-sm">
            <div className="tab-bar">
              {(['overview', 'upload', 'history'] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); setSelExam(null); }}                  className={'tab-item ' + (tab === t ? 'active' : '')}>
                  {t === 'overview' ? '总览' : t === 'upload' ? '上传' : '记录'}
                </button>
              ))}
            </div>
          </div>
        </nav>        {/* Tab Content */}
        {tab === 'overview' && <OverviewTab stats={stats} exams={exams} onPick={e => { setSelExam(e); setTab('history'); }} />}
        {tab === 'upload' && <UploadTab file={file} preview={preview} uploading={uploading} error={error} hasStudent={!!selStudent} hasKey={!!settings.apiKey} uploadOK={uploadOK} examName={examName} setExamName={setExamName} fileRef={fileRef} onFile={onFile} onUpload={doUpload} onClear={() => { setFile(null); setPreview(null); setUploadOK(false); }} />}
        {tab === 'history' && <HistoryTab exams={exams} selExam={selExam} onSelect={setSelExam} onDelete={delExam} />}
      </div>
    </>
  );
}

/* ================================================================
   Student Switcher
   ================================================================ */
function StudentSwitcher({ students, selId, onSelect, onAdd }: { students: Student[]; selId: string; onSelect: (id: string) => void; onAdd: () => void }) {
  if (students.length === 0) {    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <span className="display-lg" style={{ fontSize: 32 }}>还没有学生</span>
        <span className="caption">添加第一个孩子开始追踪学习进度</span>
        <button onClick={onAdd} className="btn-blue">+ 添加学生</button>
      </div>
    );
  }
  return (    <div className="student-switch">
      <select value={selId} onChange={e => onSelect(e.target.value)} className="student-select">
        <option value="">选择学生...</option>
        {students.map(s => <option key={s.id} value={s.id}>{s.name}{s.grade ? ` — ${s.grade}` : ''}{s.school ? ` · ${s.school}` : ''}</option>)}
      </select>
      <button onClick={onAdd} className="btn-ghost">+ 新增</button>
    </div>  );
}

/* ================================================================
   Insights - trend + summary line
   ================================================================ */
function Insights({ exams, stats }: { exams: Exam[]; stats: { total: number; avg: number; mistakes: number } }) {
  if (stats.total === 0) {
    return (
      <div style={{ marginTop: 32 }}>
        <span className="display-lg" style={{ fontSize: 32, marginBottom: 12, display: 'block' }}>还没有考试记录</span>
        <span className="caption">上传第一份试卷，AI 将自动分析并告诉你孩子的学习情况</span>
      </div>    );
  }
  const recentExams = exams.slice(0, 6);
  const trendData = recentExams.map(e => pct(e.totalScore, e.maxScore)).reverse();
  const maxVal = Math.max(...trendData, 100);  const minVal = Math.min(...trendData, 0);  const range = maxVal - minVal || 1;
  const w = 280;  const h = 48;
  const points = trendData.map((v, i) => {
    const x = (i / Math.max(1, trendData.length - 1)) * w;
    const y = h - ((v - minVal) / range) * h;    return `${x},${y}`;
  }).join(' ');

  // One-line insight
  let insight = '';  if (trendData.length >= 2) {    const diff = trendData[trendData.length - 1] - trendData[trendData.length - 2];
    if (diff > 5) insight = `比上次进步了 ${diff} 分，继续保持 💪`;
    else if (diff < -5) insight = `比上次退步了 ${Math.abs(diff)} 分，一起看看原因吧 🔍`;
    else insight = `成绩稳定，继续保持 📊`;
  } else {
    insight = '已录入第一份试卷，AI 分析中...';  }

  return (
    <>
      <div style={{ marginTop: 32, marginBottom: 8 }}>
        <span className="display-hero" style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>{insight}</span>
      </div>      {/* Mini chart */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>        <svg width="100%" viewBox={`0 0 ${w} ${h + 8}`} style={{ maxWidth: 320, height: 'auto' }}>
          <polyline fill="none" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
          {trendData.map((v, i) => {            const cx = (i / Math.max(1, trendData.length - 1)) * w;
            const cy = h - ((v - minVal) / range) * h;            return <circle key={i} cx={cx} cy={cy} r="3" fill="#0066cc" />;
          })}
        </svg>
      </div>
      <p className="caption" style={{ marginTop: 8 }}>近 {trendData.length} 次成绩趋势</p>
    </>
  );
}

/* ================================================================
   OVERVIEW TAB
   ================================================================ */
function OverviewTab({ stats, exams, onPick }: { stats: { total: number; avg: number; mistakes: number }; exams: Exam[]; onPick: (e: Exam) => void }) {
  const recent = exams.slice(0, 6);
  const subjectMap = new Map<string, { scores: number[]; trend: number }>();
  exams.forEach(e => {
    const p = pct(e.totalScore, e.maxScore);
    if (!subjectMap.has(e.subject)) subjectMap.set(e.subject, { scores: [], trend: 0 });
    subjectMap.get(e.subject)!.scores.push(p);
  });
  // Calculate trends (compare first half vs second half)
  subjectMap.forEach((v) => {
    const half = Math.floor(v.scores.length / 2);    const first = v.scores.slice(0, half);
    const second = v.scores.slice(half);
    const avg1 = first.length ? first.reduce((a, b) => a + b, 0) / first.length : 0;    const avg2 = second.length ? second.reduce((a, b) => a + b, 0) / second.length : 0;
    v.trend = avg2 - avg1;
  });

  return (
    <>
      {/* Metrics */}
      <section className="tile tile-white" style={{ padding: '32px 24px' }}>
        <div className="container-sm">
          <div className="metrics-grid">
            <Metric value={stats.total} suffix="" label="考试总数" />
            <Metric value={stats.avg} suffix="%" label="平均得分率" />
            <Metric value={stats.mistakes} suffix="" label="待复习错题" />
          </div>
        </div>
      </section>

      {/* Subject mastery */}
      {subjectMap.size > 0 && (
        <section className="tile tile-dark">
          <div className="container-sm">
            <span className="display-lg" style={{ color: '#f5f5f7', marginBottom: 32, display: 'block', textAlign: 'center' }}>各科掌握度</span>
            <div style={{ display: 'grid', gap: 20 }}>
              {Array.from(subjectMap.entries()).map(([subject, { scores, trend }]) => {
                const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                return (
                  <div key={subject}>                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span className="body-strong" style={{ color: '#f5f5f7', fontSize: 17 }}>{subject}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="body-strong" style={{ color: color(avg) }}>{avg}%</span>
                        {trend !== 0 && (
                          <span className={'badge-pill ' + (trend > 0 ? 'badge-green' : 'badge-red')} style={{ fontSize: 11 }}>                            {trend > 0 ? '↑' : '↓'} {Math.abs(Math.round(trend))}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 9999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 9999, background: color(avg), width: avg + '%', transition: 'width 0.6s' }} />
                    </div>                  </div>
                );
              })}            </div>
          </div>
        </section>
      )}

      {/* Recent mistakes */}
      {recent.length > 0 && (
        <section className="tile tile-parchment">
          <div className="container-sm">
            <span className="display-lg" style={{ fontSize: 28, marginBottom: 24, display: 'block', textAlign: 'center' }}>最近错题</span>
            <div style={{ display: 'grid', gap: 2 }}>
              {recent.map(exam => {                const mistakes = exam.questions.filter(q => !q.isCorrect);                return mistakes.slice(0, 3).map(q => (
                  <div key={q.id} onClick={() => onPick(exam)} className="card-row" style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>                      <span className={'dot ' + (q.isCorrect ? 'dot-green' : 'dot-red')} />
                      <span className="body-strong">{exam.subject}</span>
                      <span className="caption">第{q.number}题</span>                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      {q.knowledgePoint && <span className="badge-pill badge-gray">{q.knowledgePoint}</span>}
                      <span className="caption" style={{ color: '#ff3b30', fontWeight: 600 }}>{q.score}/{q.maxScore}</span>
                    </div>
                  </div>
                ));              })}
            </div>
          </div>
        </section>
      )}    </>
  );}

function Metric({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  return (
    <div className="metric-card">
      <div className="metric-value">{value}<span style={{ fontSize: 17, fontWeight: 400, color: '#7a7a7a' }}>{suffix}</span></div>
      <div style={{ fontSize: 14, color: '#7a7a7a', marginTop: 4 }}>{label}</div>
    </div>
  );
}

/* ================================================================
   UPLOAD TAB
   ================================================================ */
function UploadTab({ file, preview, uploading, error, hasStudent, hasKey, uploadOK, examName, setExamName, fileRef, onFile, onUpload, onClear }: {
  file: File | null; preview: string | null; uploading: boolean; error: string;
  hasStudent: boolean; hasKey: boolean; uploadOK: boolean;
  examName: string; setExamName: (v: string) => void;
  fileRef: React.RefObject<HTMLInputElement>; onFile: (e: any) => void; onUpload: () => void; onClear: () => void;
}) {  return (
    <section className="tile tile-parchment">
      <div className="container-sm">
        {!hasKey && (
          <div className="card-store fade-in" style={{ marginBottom: 20, background: '#fff8e1', borderColor: '#ffe082' }}>
            <span className="body-strong" style={{ color: '#f57c00', fontSize: 14 }}>⚠ 请先在右上角设置 API Key</span>
          </div>
        )}
        {uploadOK && (
          <div className="card-store fade-in" style={{ marginBottom: 20, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <span className="body-strong" style={{ color: '#16a34a', fontSize: 14 }}>✓ 分析完成！请在「记录」查看详细结果</span>
          </div>
        )}
        <div className="card-store fade-in">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <span className="display-lg" style={{ display: 'block', fontSize: 28, marginBottom: 8 }}>拍照上传试卷</span>
            <span className="caption">支持自动识别题目与错题，越清晰越准确</span>
          </div>
          <input placeholder="考试名称（可选，如：期中考试）" value={examName} onChange={e => setExamName(e.target.value)} className="input" style={{ marginBottom: 16 }} />
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
          {preview ? (
            <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: '#f5f5f7', marginBottom: 16 }}>
              <img src={preview} alt="预览" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', display: 'block' }} />
              <button onClick={onClear} className="btn-utility" style={{ position: 'absolute', top: 12, right: 12, borderRadius: '50%', width: 32, height: 32, padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="upload-area">
              <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
              <span className="caption">点击拍照或选择图片</span>            </button>
          )}
          <button onClick={onUpload} disabled={!file || uploading || !hasStudent} className="btn-blue" style={{ width: '100%' }}>
            {uploading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="spinner" />
                正在分析中…
              </span>
            ) : '开始分析'}
          </button>
          {error && (
            <div className="card-store" style={{ marginTop: 16, background: '#fef2f2', borderColor: '#fecaca' }}>
              <span className="caption" style={{ color: '#dc2626', fontWeight: 600 }}>{error}</span>            </div>
          )}
        </div>
      </div>
    </section>
  );
}/* ================================================================
   HISTORY TAB
   ================================================================ */
function HistoryTab({ exams, selExam, onSelect, onDelete }: { exams: Exam[]; selExam: Exam | null; onSelect: (e: Exam | null) => void; onDelete: (id: string) => void }) {
  if (selExam) return <ExamDetail exam={selExam} onBack={() => onSelect(null)} onDelete={onDelete} />;
  return (
    <section className="tile tile-white" style={{ padding: '0 24px 80px' }}>
      <div className="container-sm">
        {exams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <span className="display-lg" style={{ display: 'block', marginBottom: 8, fontSize: 28 }}>暂无记录</span>            <span className="caption">先上传试卷开始吧</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {exams.map(exam => {
              const correct = exam.questions.filter(q => q.isCorrect).length;              const p = pct(exam.totalScore, exam.maxScore);
              return (
                <div key={exam.id} onClick={() => onSelect(exam)} className="card-store history-row" style={{ cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="body-strong">{exam.name || exam.subject}</span>
                      <span className="body-strong" style={{ color: color(p) }}>{exam.totalScore}/{exam.maxScore}</span>
                      <span className={'badge-pill ' + (p >= 80 ? 'badge-green' : p >= 60 ? 'badge-amber' : 'badge-red')}>{p}%</span>
                    </div>
                    <p className="caption" style={{ marginTop: 4 }}>{exam.student?.name || '未知'} · {new Date(exam.examDate).toLocaleDateString('zh-CN')} · 答对 {correct}/{exam.questions.length}</p>                  </div>
                  <button onClick={e => { e.stopPropagation(); onDelete(exam.id); }} className="btn-link-sm" style={{ color: '#ff3b30', marginLeft: 12 }}>删除</button>
                </div>
              );
            })}
          </div>        )}
      </div>
    </section>
  );
}

/* ================================================================
   EXAM DETAIL
   ================================================================ */
function ExamDetail({ exam, onBack, onDelete }: { exam: Exam; onBack: () => void; onDelete: (id: string) => void }) {  const mistakes = exam.questions.filter(q => !q.isCorrect);
  const p = pct(exam.totalScore, exam.maxScore);
  return (
    <>
      <section className="tile tile-dark">
        <div className="container-sm" style={{ textAlign: 'center' }}>
          <button onClick={onBack} className="btn-link-sm" style={{ color: '#2997ff', display: 'inline-block', marginBottom: 24 }}>← 返回列表</button>
          <span className="display-hero" style={{ color: '#f5f5f7', display: 'block', marginBottom: 8 }}>{exam.name || exam.subject}</span>          <p className="caption" style={{ color: '#a1a1a6', marginBottom: 32 }}>{exam.student?.name || '}知'} · {new Date(exam.examDate).toLocaleDateString('zh-CN')}</p>
          <div style={{ marginBottom: 8 }}>
            <span className="display-hero" style={{ color: color(p) }}>{exam.totalScore}</span>
            <span style={{ fontSize: 40, fontWeight: 600, color: '#7a7a7a', letterSpacing: 0 }}> / {exam.maxScore}</span>          </div>
          <p className="tagline" style={{ color: '#a1a1a6', fontWeight: 400, fontSize: 21 }}>正确率 {p}% · 错题 {mistakes.length} 道</p>
          <div style={{ maxWidth: 240, margin: '24px auto 0' }} className="progress-on-dark">
            <div className={`progress-fill ${prog(p)}`} style={{ width: p + '%' }} />
          </div>
          <button onClick={() => onDelete(exam.id)} className="btn-link-sm" style={{ color: '#ff3b30', display: 'inline-block', marginTop: 24 }}>删除此记录</button>
        </div>
      </section>

      {exam.analysis && (
        <section className="tile tile-parchment">
          <div className="container-sm">            <span className="display-lg" style={{ display: 'block', fontSize: 24, marginBottom: 16 }}>AI 分析建议</span>
            <p style={{ fontSize: 17, lineHeight: 1.47, color: '#1d1d1f', whiteSpace: 'pre-line' }}>{exam.analysis}</p>
          </div>
        </section>
      )}      {mistakes.length > 0 && (        <section className="tile tile-white">
          <div className="container-sm">
            <span className="display-lg" style={{ display: 'block', fontSize: 24, marginBottom: 24 }}>错题 ({mistakes.length})</span>
            <div style={{ display: 'grid', gap: 8 }}>
              {mistakes.map(q => (
                <div key={q.id} className="card-store" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span className="badge-pill badge-red">第 {q.number} 题</span>
                    <span className="caption" style={{ color: '#ff3b30', fontWeight: 600 }}>{q.score}/{q.maxScore}</span>
                  </div>
                  {q.content && <p style={{ fontSize: 17, color: '#1d1d1f', lineHeight: 1.47 }}>{q.content}</p>}
                  {q.knowledgePoint && <p className="caption" style={{ marginTop: 8, fontWeight: 600, color: '#333' }}>📌 {q.knowledgePoint}</p>}
                  {q.suggestion && <p className="caption" style={{ marginTop: 4 }}>💡 {q.suggestion}</p>}
                </div>
              ))}
            </div>          </div>
        </section>
      )}      <section className="tile tile-parchment">
        <div className="container-sm">
          <span className="display-lg" style={{ display: 'block', fontSize: 24, marginBottom: 24 }}>全部题目</span>          <div style={{ display: 'grid', gap: 1 }}>
            {exam.questions.map(q => (
              <div key={q.id} className="card-store q-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={'dot ' + (q.isCorrect ? 'dot-green' : 'dot-red')} />
                  <span className="body-strong">第 {q.number} 题</span>
                  {q.content && <span className="caption" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.content}</span>}
                </div>
                <span className="caption" style={{ fontWeight: 600, color: q.isCorrect ? '#34c759' : '#ff3b30' }}>{q.score}/{q.maxScore}</span>
              </div>
            ))}
          </div>
        </div>      </section>

      {exam.rawResponse && (
        <section className="tile tile-dark">
          <details className="container-sm">            <summary className="btn-link-sm" style={{ color: '#a1a1a6' }}>查看 AI 原始响应</summary>
            <pre className="scroll-thin code-block">{exam.rawResponse}</pre>
          </details>
        </section>
      )}
    </>
  );
}