import { useEffect, useRef, useState } from 'react';
import { useAdminApi } from './AdminContext.jsx';
import { AdminHeading } from './AdminUI.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminImport() {
  const api = useAdminApi();
  const [programs, setPrograms] = useState([]);
  const [programId, setProgramId] = useState('');
  const [results, setResults] = useState(null);
  const [rawJson, setRawJson] = useState('');
  const [rawCsv, setRawCsv] = useState('');
  const [csvMeta, setCsvMeta] = useState({ code: '', title: '', year: String(new Date().getFullYear()) });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const toast = useToast();

  useEffect(() => {
    api('/admin/catalog/universities')
      .then((d) => {
        // Импортын хаяг болох зөвхөн ХИЧЭЭЛүүд л харагдана —
        // 41 мэргэжил (МТЭС/БС/ХЗС/ШУС/ИТС/УТСОУХНУС) сонголтод орохгүй
        const MAJOR_SCHOOLS = ['МТЭС', 'БС', 'ХЗС', 'ШУС', 'ИТС', 'УТСОУХНУС'];
        const list = d.universities.flatMap((u) =>
          u.programs
            .filter((p) => !MAJOR_SCHOOLS.includes(p.school))
            .map((p) => ({ ...p, university: u.name }))
        );
        setPrograms(list);
      })
      .catch((e) => toast(e.message));
  }, []);

  const showResults = (r) => {
    setResults(r);
    if (r.errors.length) toast(`${r.results.length} амжилттай, ${r.errors.length} алдаа`);
    else toast(`${r.results.length} файл амжилттай импортлогдлоо`);
  };

  const uploadFiles = async () => {
    if (!programId) return toast('Хичээл сонгоно уу');
    if (!fileRef.current.files.length) return toast('JSON файл сонгоно уу');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('programId', programId);
      for (const f of fileRef.current.files) fd.append('files', f);
      showResults(await api('/admin/import/upload', { method: 'POST', formData: fd }));
      fileRef.current.value = '';
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  const pasteImport = async () => {
    if (!programId) return toast('Хичээл сонгоно уу');
    setBusy(true);
    try {
      showResults(await api('/admin/import/raw', { method: 'POST', body: { programId, json: rawJson } }));
      setRawJson('');
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  const loadTemplate = () =>
    api('/admin/import/template').then((template) => setRawJson(JSON.stringify(template, null, 2))).catch((error) => toast(error.message));

  const csvImport = async () => {
    if (!programId) return toast('Хичээл сонгоно уу');
    setBusy(true);
    try {
      showResults(await api('/admin/import/csv', {
        method: 'POST',
        body: { programId, examCode: csvMeta.code.trim(), title: csvMeta.title.trim(), year: Number(csvMeta.year), csv: rawCsv },
      }));
      setRawCsv('');
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  const PROMPT = `ЧИ НЬ ШАЛГАЛТЫН МАТЕРИАЛЫГ JSON РУУ ХӨРВҮҮЛЭГЧ БОЛОН БОДОГЧ AI.

АЖИЛ: Би материал (текст/зураг/PDF) өгнө. Чи ялгаж, ӨӨРӨӨ БОДОЖ зөв хариултыг тооцоолж, доорх SCHEMA-аар ЗӨВХӨН JSON гаргана.

SCHEMA:
{
  "exam_id": "kebab-case-slug",
  "title": "Хичээлийн нэр — Шалгалтын төрөл (он)",
  "year": 2026, "source": "...", "variant": "Variant B", "durationMin": 90,
  "questions": [{
    "type": "open",
    "prompt": "Асуулт $...$ LaTeX",
    "model_solution": "Алхамчилсан бодолт $...$",
    "answer": "1 зөв хариу $...$",
    "choices": [
      {"key":"A","text":"..."},
      {"key":"B","text":"..."},
      {"key":"C","text":"..."},
      {"key":"D","text":"..."}
    ],
    "correct_choice": "A",
    "explanation": "Яагаад A зөв, B/C/D буруу",
    "points": 3, "topic":"Интеграл", "tags":["Интеграл"], "level":"medium", "needs_review": false
  }]
}

ДҮРЭМ — 2 ГОРИМ ХОЁУЛ АСУУДАЛГҮЙ:
- LaTeX зөвхөн $...$.
- Асуулт бүрд 2-уулаа: model_solution+answer (Задгайд AI) + choices[4] (3 буруу+1 зөв)+correct_choice+explanation (Тестэд 4 товч). Test: choices дарааллыг ямар ч санамсаргүй өг — систем шалгалт өгөх тоолонд per-attempt shuffle хийж байрлал өөрчилнө, зөв хариулт дагана.
- exam_id давтагдашгүй.

ОДОО: Доорх материалаас JSON үүсгэ. Зөвхөн JSON:
[ЭНД шалгалтын текст/зураг наа]`;

  const [promptCopied, setPromptCopied] = useState(false);
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT);
      setPromptCopied(true);
      toast('Prompt хууллаа — Claude-д наа');
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      toast('Хуулах амжилтгүй — гараар хуулна уу');
    }
  };

  return (
    <>
      <AdminHeading eyebrow="СУРГАЛТЫН КОНТЕНТ" title="Контент импорт" description="Хичээлээ сонгоод JSON файл, текст эсвэл CSV-ээс шалгалтын материалыг оруул." />

      <div className="card">
        <label htmlFor="program">Импортоо хийх хичээл *</label>
        <select id="program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
          <option value="">— Сонгох —</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>{p.university !== 'Монголын Их Сургууль' ? `${p.university} · ` : ''}{p.name}</option>
          ))}
        </select>
        {programs.length === 0 && (
          <p className="small error-text" style={{ marginTop: 6 }}>
            Хичээл олдсонгүй — эхлээд «Бүтэц (Сургууль/Шалгалт)» хэсэгт хичээл нэмээрэй.
          </p>
        )}
        <p className="small muted">
          Файлын бүтэц: <span className="mono">{`{ exam_id, title, source, year, variant, questions[] }`}</span> —
          асуулт бүр <span className="mono">{`{ type, prompt, model_solution, answer, points, needs_review, tags }`}</span>.
          Ижил <span className="mono">exam_id</span>-тай бол шинэчлэн оршино.
        </p>
      </div>

      <div className="card" style={{ borderLeft: '3px solid var(--blue-ink)' }}>
        <h3 style={{ marginTop: 0 }}>Claude-д өгөх Prompt — Test (4 хариу) + Задгай (1 зөв) 2 горим</h3>
        <p className="small muted" style={{ marginTop: 4 }}>
          Шалгалтын материалаа Claude-д өгч JSON болгуулахдаа энэ prompt-ыг хуулж хэрэглэнэ. `3 буруу + 1 зөв` Тест + `1 зөв` Задгай 2-уулаа агуулсан 1 JSON гарч, 2 горим хоёул `AUTO/AI` + `per-attempt random` асуудалгүй ажиллана.
        </p>
        <textarea readOnly rows={7} className="mono small" style={{ background: 'rgba(37,99,235,0.04)', cursor: 'default' }} value={PROMPT} onFocus={(e) => e.target.select()} />
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className={`btn small ${promptCopied ? 'secondary' : ''}`} onClick={copyPrompt}>
            {promptCopied ? '✓ Хууллаа' : '📋 Prompt хуулах'}
          </button>
          <span className="small faint" style={{ alignSelf: 'center' }}>Claude → SYSTEM + USER prompt болгон наа → материалаа хавсарга → JSON гарна</span>
        </div>
      </div>

      <div className="card">
        <h3>1 · JSON файл upload</h3>
        <input ref={fileRef} type="file" accept=".json,application/json" multiple />
        <button className="btn" style={{ marginTop: 12 }} disabled={busy} onClick={uploadFiles}>
          {busy ? 'Импортлож байна…' : 'Upload хийх'}
        </button>
      </div>

      <div className="card">
        <h3>2 · Эсвэл JSON paste</h3>
        <textarea rows={8} className="mono small" placeholder='{"exam_id": "…", "questions": […]}' value={rawJson}
          onChange={(e) => setRawJson(e.target.value)} />
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn secondary small" onClick={loadTemplate}>Загвар авах</button>
          <button className="btn small" disabled={busy || !rawJson.trim()} onClick={pasteImport}>Импортлох</button>
        </div>
      </div>

      <div className="card">
        <h3>3 · Эсвэл CSV paste</h3>
        <p className="small muted">
          Толгой мөр: <span className="mono">type,prompt,model_solution,answer,points,topic,tags</span> —
          тасалбар дотор үлдэгдэл байвал <span className="mono">&quot;…&quot;</span>-аар хамгаалж, tags-ийг <span className="mono">|</span>-аар тусгаарлана.
        </p>
        <div className="field-inline">
          <div>
            <label htmlFor="admin-import-field-1">Шалгалтын код *</label>
            <input id="admin-import-field-1" className="mono" placeholder="math1b-2025-fall-variant1"
              value={csvMeta.code} onChange={(e) => setCsvMeta({ ...csvMeta, code: e.target.value })} />
          </div>
          <div>
            <label htmlFor="admin-import-field-2">Гарчиг *</label>
            <input id="admin-import-field-2" placeholder="Математик 1Б — Явцын шалгалт (2025)"
              value={csvMeta.title} onChange={(e) => setCsvMeta({ ...csvMeta, title: e.target.value })} />
          </div>
          <div style={{ maxWidth: 110 }}>
            <label htmlFor="admin-import-field-3">Он *</label>
            <input id="admin-import-field-3" type="number" value={csvMeta.year} onChange={(e) => setCsvMeta({ ...csvMeta, year: e.target.value })} />
          </div>
        </div>
        <textarea rows={6} className="mono small" style={{ marginTop: 8 }}
          placeholder={'type,prompt,model_solution,answer,points,topic,tags\nopen,"Асуулт…","Шийдэл…","Хариулт",3,"Хязгаар","Хязгаар|Дараалал"}'}
          value={rawCsv} onChange={(e) => setRawCsv(e.target.value)} />
        <button className="btn small" style={{ marginTop: 10 }}
          disabled={busy || !rawCsv.trim() || !csvMeta.code || !csvMeta.title}
          onClick={csvImport}>
          CSV импортлох
        </button>
      </div>

      {results && (
        <div className="card">
          <h3>Үр дүн</h3>
          {results.results.map((r) => (
            <p key={r.file} style={{ margin: '4px 0' }}>
              ✓ <span className="mono">{r.file}</span> → <span className="mono">{r.code}</span>: {r.imported} асуулт
            </p>
          ))}
          {results.errors.map((e) => (
            <p key={e.file} className="error-text small" style={{ margin: '4px 0' }}>
              ✗ {e.file}: {e.error}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
