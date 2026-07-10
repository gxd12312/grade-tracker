'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const AI_NAME = process.env.NEXT_PUBLIC_AI_NAME || 'AI';

interface Student { id: string; name: string; grade?: string | null; school?: string | null; }
interface Question { id: string; number: string; content?: string | null; score: number; maxScore: number; isCorrect: boolean; knowledgePoint?: string | null; suggestion?: string | null; }
interface Exam { id: string; name: string; subject: string; totalScore: number; maxScore: number; examDate: string; semester?: string | null; analysis?: string | null; rawResponse?: string | null; student: { name: string; grade?: string | null; school?: string | null }; questions: Question[]; }
interface Settings { apiKey: string; baseURL: string; model: string; }
type Tab = 'overview' | 'upload' | 'history';

const DEFAULT_SETTINGS: Settings = { apiKey: '', baseURL: '', model: 'gpt-4o' };

function loadSettings(): Settings {
  try { const raw = localStorage.getItem('ai_settings'); if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; } catch {}
  return DEFAULT_SETTINGS;
}

function scoreColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function progressClass(pct: number) {
  if (pct >= 80) return 'progress-good';
  if (pct >= 60) return 'progress-medium';
  return 'progress-low';
}

function ProgressBar({ pct, size = 'md' }: { pct: number; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'lg' ? 'h-3.5' : size === 'sm' ? 'h-1.5' : 'h-2.5';
  return (
    <div className={'progress-track ' + h}>
      <div className={'progress-fill ' + progressClass(pct)} style={{ width: pct + '%' }} />
    </div>
  );
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('');
  const [newStudentSchool, setNewStudentSchool] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [stats, setStats] = useState({ totalExams: 0, avgScore: 0, totalMistakes: 0 });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [sitePassword, setSitePassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [examName, setExamName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSettings(loadSettings()); setSitePassword(localStorage.getItem('site_password') || ''); }, []);

  const saveSettings = (s: Settings) => { setSettings(s); localStorage.setItem('ai_settings', JSON.stringify(s)); };

  // Get auth headers for API calls
  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    const sp = localStorage.getItem('site_password');
    if (sp) {
      headers['x-site-auth'] = sp;
    }
    return headers;
  };

  // Handle API errors (especially 401)
  const handleApiError = async (res: Response) => {
    if (res.status === 401) {
      setIsAuthenticated(false);
      setError('未授权：请在设置中输入访问密码');
      return true;
    }
    return false;
  };

  const loadData = useCallback(async () => {
    try {
      const authHeaders = getAuthHeaders();
      const [sRes, eRes] = await Promise.all([fetch('/api/students', { headers: authHeaders }), fetch('/api/exams', { headers: authHeaders })]);
      if (await handleApiError(sRes) || await handleApiError(eRes)) return;
      const sData = await sRes.json(); setStudents(sData);
      const eData = await eRes.json(); setExams(eData);
      if (eData.length > 0) {
        const total = eData.reduce((sum: number, e: Exam) => sum + e.totalScore, 0);
        const maxTotal = eData.reduce((sum: number, e: Exam) => sum + e.maxScore, 0);
        const mistakes = eData.reduce((sum: number, e: Exam) => sum + e.questions.filter((q: Question) => !q.isCorrect).length, 0);
        setStats({ totalExams: eData.length, avgScore: maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0, totalMistakes: mistakes });
      }
    } catch (err) { console.error('Failed to load data:', err); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddStudent = async () => {
    if (!newStudentName.trim()) return;
    try {
      const res = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ name: newStudentName, grade: newStudentGrade, school: newStudentSchool }) });
      if (await handleApiError(res)) return;
      const student = await res.json();
      if (student.id) { setStudents([student, ...students]); setSelectedStudent(student.id); setNewStudentName(''); setNewStudentGrade(''); setNewStudentSchool(''); setShowAddStudent(false); }
    } catch { setError('添加学生失败'); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setError(''); setUploadSuccess(false); }
  };

  const handleUpload = async () => {
    if (!file || !selectedStudent) { setError('请选择学生和试卷图片'); return; }
    if (!settings.apiKey) { setError('请先在右上角设置中填写 API Key'); return; }
    setUploading(true); setError(''); setUploadSuccess(false);
    try {
      const formData = new FormData();
      formData.append('file', file); formData.append('studentId', selectedStudent); formData.append('name', examName);
      const headers: Record<string, string> = {};
      if (settings.apiKey) headers['x-api-key'] = settings.apiKey;
      if (settings.baseURL) headers['x-base-url'] = settings.baseURL;
      if (settings.model) headers['x-model'] = settings.model;
      const res = await fetch('/api/parse', { method: 'POST', body: formData, headers: { ...headers, ...getAuthHeaders() } });
      if (await handleApiError(res)) { setUploading(false); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '解析失败');
      setFile(null); setPreview(null); setUploadSuccess(true); setExamName('');
      await loadData();
    } catch (err: any) {
      setError(err.message || '上传解析失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm('确定要删除这条考试记录吗？')) return;
    try {
      const delRes = await fetch('/api/exams/' + id, { method: 'DELETE', headers: getAuthHeaders() });
      if (await handleApiError(delRes)) return;
      if (selectedExam?.id === id) setSelectedExam(null);
      await loadData();
    } catch { setError('删除失败'); }
  };

  return (
    <div className="min-h-screen pb-8 relative">
      <header className="gradient-header text-white px-4 pt-6 pb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold tracking-tight">成绩记录</h1>
              <p className="text-indigo-200 text-sm mt-0.5">AI 智能分析试卷错题</p>
            </div>
            <button onClick={() => setShowSettings(!showSettings)} className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>

          {showSettings && (
            <div className="rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20 p-5 space-y-4 fade-in">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <span className="text-base">⚙️</span>
                  <span>AI 设置</span>
                </h2>
                <button onClick={() => setShowSettings(false)} className="text-xs text-white/60 hover:text-white/90 transition-colors">关闭</button>
              </div>
              <p className="text-xs text-indigo-200 -mt-2">设置后自动保存在浏览器本地</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-indigo-100 mb-1.5">API Key <span className="text-red-300">*</span></label>
                  <input type="password" placeholder="sk-..." value={settings.apiKey} onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })} className="w-full rounded-xl bg-white/15 border border-white/20 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-indigo-100 mb-1.5">Base URL</label>
                    <input type="text" placeholder="https://api.deepseek.com/v1" value={settings.baseURL} onChange={(e) => setSettings({ ...settings, baseURL: e.target.value })} className="w-full rounded-xl bg-white/15 border border-white/20 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-indigo-100 mb-1.5">Model</label>
                    <input type="text" placeholder="gpt-4o" value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })} className="w-full rounded-xl bg-white/15 border border-white/20 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition" />
                  </div>
                </div>
                <div className="border-t border-white/10 pt-3 mt-3">
                  <label className="block text-xs font-medium text-indigo-100 mb-1.5">网站访问密码（可选）</label>
                  <input type="password" placeholder="设置密码后，API 访问需要验证" value={sitePassword} onChange={(e) => setSitePassword(e.target.value)} className="w-full rounded-xl bg-white/15 border border-white/20 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition" />
                  <p className="text-xs text-indigo-200 mt-1">设置后请妥善保管，所有写操作需要此密码</p>
                </div>
                <button onClick={() => { saveSettings(settings); localStorage.setItem('site_password', sitePassword); setShowSettings(false); }} className="w-full rounded-xl bg-white text-indigo-700 py-2.5 text-sm font-semibold hover:bg-white/90 transition-colors">保存设置</button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 -mt-3">
        <div className="tab-bar mb-5">
          {([
            { id: 'overview' as Tab, label: '概览' },
            { id: 'upload' as Tab, label: '上传' },
            { id: 'history' as Tab, label: '记录' },
          ]).map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setSelectedExam(null); }} className={'tab-btn ' + (tab === t.id ? 'tab-active' : 'tab-inactive')}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-5">
          {students.length === 0 || showAddStudent ? (
            <div className="card glass glass-hover p-4 space-y-3 fade-in">
              <p className="text-sm font-semibold text-gray-700">添加学生</p>
              <input type="text" placeholder="姓名" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} className="input-field" />
              <input type="text" placeholder="年级" value={newStudentGrade} onChange={(e) => setNewStudentGrade(e.target.value)} className="input-field" />
              <input type="text" placeholder="学校（可选）" value={newStudentSchool} onChange={(e) => setNewStudentSchool(e.target.value)} className="input-field" />
              <div className="flex gap-2">
                <button onClick={handleAddStudent} className="btn-primary flex-1">添加</button>
                {students.length > 0 && <button onClick={() => setShowAddStudent(false)} className="btn-ghost">取消</button>}
              </div>
            </div>
          ) : (
            <div className="flex gap-2 items-center fade-in glass rounded-2xl p-2 border border-white/20">
              <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} className="input-field flex-1">
                <option value="">选择学生...</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.grade ? ' (' + s.grade + ')' : ''}{s.school ? ' - ' + s.school : ''}</option>)}
              </select>
              <button onClick={() => setShowAddStudent(true)} className="btn-ghost whitespace-nowrap">+ 新增</button>
            </div>
          )}
        </div>

        {tab === 'overview' && <OverviewTab stats={stats} exams={exams} onSelectExam={(exam) => { setSelectedExam(exam); setTab('history'); }} />}
        {tab === 'upload' && <UploadTab file={file} preview={preview} uploading={uploading} error={error} uploadSuccess={uploadSuccess} fileInputRef={fileInputRef} onFileChange={handleFileChange} onUpload={handleUpload} onClearFile={() => { setFile(null); setPreview(null); setUploadSuccess(false); }} hasStudent={!!selectedStudent} hasApiKey={!!settings.apiKey} examName={examName} setExamName={setExamName} />}
        {tab === 'history' && <HistoryTab exams={exams} selectedExam={selectedExam} onSelect={setSelectedExam} onDelete={handleDeleteExam} />}
      </main>
    </div>
  );
}

function OverviewTab({ stats, exams, onSelectExam }: { stats: { totalExams: number; avgScore: number; totalMistakes: number }; exams: Exam[]; onSelectExam: (exam: Exam) => void }) {
  const recent = exams.slice(0, 5);
  const subjectMap = new Map<string, number[]>();
  exams.forEach(e => {
    const pct = e.maxScore > 0 ? Math.round((e.totalScore / e.maxScore) * 100) : 0;
    if (!subjectMap.has(e.subject)) subjectMap.set(e.subject, []);
    subjectMap.get(e.subject)!.push(pct);
  });

  return (
    <div className="space-y-5 fade-in">
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card glass-hover">
          <div className="text-2xl font-bold text-indigo-600">{stats.totalExams}</div>
          <div className="text-xs text-gray-500 mt-1">考试总数</div>
        </div>
        <div className="stat-card glass-hover">
          <div className="text-2xl font-bold text-indigo-600">{stats.avgScore}%</div>
          <div className="text-xs text-gray-500 mt-1">平均得分</div>
        </div>
        <div className="stat-card glass-hover">
          <div className="text-2xl font-bold text-indigo-600">{stats.totalMistakes}</div>
          <div className="text-xs text-gray-500 mt-1">错题总数</div>
        </div>
      </div>

      {subjectMap.size > 0 && (
        <div className="card glass glass-hover p-4"><h3 className="section-title mb-3">📊 各科平均分</h3>
          <div className="space-y-3">
            {Array.from(subjectMap.entries()).map(([subject, scores]) => {
              const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
              return (
                <div key={subject}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{subject}</span>
                    <span className={'text-xs font-semibold ' + scoreColor(avg)}>{avg}%</span>
                  </div>
                  <ProgressBar pct={avg} size="sm" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="card glass glass-hover p-4"><h3 className="section-title mb-3">📝 最近考试</h3>
          <div className="space-y-1">
            {recent.map((exam) => {
              const pct = exam.maxScore > 0 ? Math.round((exam.totalScore / exam.maxScore) * 100) : 0;
              return (
                <div key={exam.id} onClick={() => onSelectExam(exam)} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 truncate">{exam.subject}</span>
                      <span className={'text-sm font-bold ' + scoreColor(pct)}>{exam.totalScore}/{exam.maxScore}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{exam.name !== exam.subject ? exam.subject + ' · ' : ''}{exam.student?.name || '未知'} &middot; {new Date(exam.examDate).toLocaleDateString('zh-CN')}</p>
                  </div>
                  <div className="w-16 ml-3"><ProgressBar pct={pct} size="sm" /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.totalExams === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white/50 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 font-medium">还没有考试记录</p>
          <p className="text-gray-400 text-sm mt-1">点击上方「上传」标签开始</p>
        </div>
      )}
    </div>
  );
}

function UploadTab({ file, preview, uploading, error, uploadSuccess, fileInputRef, onFileChange, onUpload, onClearFile, hasStudent, hasApiKey, examName, setExamName }: {
  file: File | null; preview: string | null; uploading: boolean; error: string; uploadSuccess: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>; onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void; onClearFile: () => void; hasStudent: boolean; hasApiKey: boolean;
  examName: string; setExamName: (v: string) => void;
}) {
  return (
    <div className="space-y-5 fade-in">
      {!hasApiKey && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span>请先在右上角设置中填写 API Key</span>
        </div>
      )}

      {uploadSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <span className="text-base">✅</span>
          <span>分析完成！请在「记录」标签查看详情</span>
        </div>
      )}

      <div className="card glass glass-hover p-5 space-y-4">
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-700 mb-1">📸 拍照/选择试卷照片</div>
          <input type="text" placeholder="考试名称（可选，如：期中考试）" value={examName} onChange={(e) => setExamName(e.target.value)} className="input-field mb-3" />
          <p className="text-xs text-gray-400">照片越清晰，识别效果越好</p>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onFileChange} className="hidden" />

        {preview ? (
          <div className="relative rounded-2xl overflow-hidden bg-gray-100">
            <img src={preview} alt="Preview" className="w-full max-h-80 object-contain" />
            <button onClick={onClearFile} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors text-sm">✕</button>
          </div>
        ) : (
          <button onClick={() => fileInputRef.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform inline-block">📷</div>
            <p className="text-sm text-gray-500 font-medium">点击拍照或选择图片</p>
          </button>
        )}

        <button onClick={onUpload} disabled={!file || uploading || !hasStudent} className="btn-primary w-full">
          {uploading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              正在分析中...
            </span>
          ) : (
            <span>开始分析</span>
          )}
        </button>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ exams, selectedExam, onSelect, onDelete }: { exams: Exam[]; selectedExam: Exam | null; onSelect: (exam: Exam | null) => void; onDelete: (id: string) => void }) {
  if (selectedExam) {
    const mistakes = selectedExam.questions.filter((q) => !q.isCorrect);
    const pct = selectedExam.maxScore > 0 ? Math.round((selectedExam.totalScore / selectedExam.maxScore) * 100) : 0;
    return (
      <div className="space-y-4 slide-up">
        <div className="gradient-header rounded-2xl p-6 text-center text-white">
          <button onClick={() => onSelect(null)} className="float-left text-white/70 hover:text-white transition-colors text-sm">← 返回</button>
          <div className="clear-both" />
          <h2 className="text-xl font-bold tracking-tight">{selectedExam.name || selectedExam.subject}</h2>
          <p className="text-indigo-200 text-sm mt-1">{selectedExam.name !== selectedExam.subject ? selectedExam.subject + ' · ' : ''}{selectedExam.student?.name || '未知'} &middot; {new Date(selectedExam.examDate).toLocaleDateString('zh-CN')}</p>
          <div className="mt-4">
            <span className={scoreColor(pct) + ' font-bold text-4xl'}>{selectedExam.totalScore}</span>
            <span className="text-2xl text-white/50 font-normal">/{selectedExam.maxScore}</span>
          </div>
          <p className="text-sm text-indigo-200 mt-2">正确率 {pct}% &middot; 错题 {mistakes.length} 道</p>
          <div className="max-w-xs mx-auto mt-4"><ProgressBar pct={pct} size="lg" /></div>
        </div>

        {selectedExam.analysis && (
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 slide-up">
            <h3 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2 text-sm">
              💡 分析建议
            </h3>
            <p className="text-sm text-indigo-800 whitespace-pre-line leading-relaxed">{selectedExam.analysis}</p>
          </div>
        )}

        {mistakes.length > 0 && (
          <div className="card glass glass-hover p-5 space-y-3 slide-up">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              错题 ({mistakes.length})
            </h3>
            {mistakes.map((q) => (
              <div key={q.id} className="rounded-xl border border-red-100 bg-red-50/60 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="badge-wrong">第 {q.number} 题</span>
                  <span className="text-xs text-red-600 font-semibold">{q.score}/{q.maxScore}</span>
                </div>
                {q.content && <p className="text-sm text-gray-700">{q.content}</p>}
                {q.knowledgePoint && <p className="mt-1.5 text-xs font-medium text-red-700 bg-red-100/60 inline-block px-2 py-0.5 rounded-full">📌 {q.knowledgePoint}</p>}
                {q.suggestion && <p className="mt-2 text-xs text-gray-600 leading-relaxed">💡 {q.suggestion}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="card glass glass-hover p-5 space-y-2 slide-up">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
            全部题目
          </h3>
          {selectedExam.questions.map((q) => (
            <div key={q.id} className={'flex items-center justify-between rounded-xl px-4 py-2.5 text-sm ' + (q.isCorrect ? 'bg-emerald-50/60' : 'bg-red-50/60')}>
              <div className="flex items-center gap-2.5">
                <span className={'w-2 h-2 rounded-full ' + (q.isCorrect ? 'bg-emerald-500' : 'bg-red-500')} />
                <span className="font-medium text-gray-700">第 {q.number} 题</span>
                {q.content && <span className="text-gray-400 truncate max-w-[200px]">{q.content}</span>}
              </div>
              <span className={'text-xs font-semibold ' + (q.isCorrect ? 'text-emerald-600' : 'text-red-600')}>{q.score}/{q.maxScore}</span>
            </div>
          ))}
        </div>

        {selectedExam.rawResponse && (
          <details className="rounded-2xl border border-gray-200 bg-gray-50 p-4 slide-up">
            <summary className="cursor-pointer text-sm font-medium text-gray-500 select-none hover:text-gray-700 transition-colors">查看 AI 原始响应</summary>
            <pre className="mt-3 rounded-xl bg-gray-900 p-4 text-xs text-green-400 whitespace-pre-wrap max-h-60 overflow-auto custom-scrollbar">{selectedExam.rawResponse}</pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 fade-in">
      {exams.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white/50 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 font-medium">暂无考试记录</p>
          <p className="text-gray-400 text-sm mt-1">先从上传试卷照片开始吧</p>
        </div>
      ) : (
        exams.map((exam, idx) => {
          const correct = exam.questions.filter((q) => q.isCorrect).length;
          const total = exam.questions.length;
          const pct = exam.maxScore > 0 ? Math.round((exam.totalScore / exam.maxScore) * 100) : 0;
          return (
            <div key={exam.id} className="card-interactive glass glass-hover p-4 slide-up" style={{ animationDelay: idx * 50 + 'ms' }}>
              <div className="flex items-start justify-between">
                <div className="cursor-pointer flex-1 min-w-0" onClick={() => onSelect(exam)}>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800 truncate">{exam.subject}</h3>
                    <span className={'text-sm font-bold ' + scoreColor(pct)}>{exam.totalScore}/{exam.maxScore}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{exam.name !== exam.subject ? exam.subject + ' · ' : ''}{exam.student?.name || '未知'} &middot; {new Date(exam.examDate).toLocaleDateString('zh-CN')} &middot; 答对 {correct}/{total}</p>
                  <ProgressBar pct={pct} size="sm" />
                </div>
                <button onClick={(e) => { e.stopPropagation(); onDelete(exam.id); }} className="text-gray-300 hover:text-red-500 text-lg ml-3 mt-0.5 transition-colors leading-none px-1">✕</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
