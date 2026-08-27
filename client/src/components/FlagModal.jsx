import { useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

export default function FlagModal({ question, onClose }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await api('/flags', { method: 'POST', body: { questionId: question.id, reason } });
      toast('Flag илгээлээ. Админ шалгах болно.');
      onClose();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Асуултад тэмдэглэгээ (flag)</h3>
        <p className="small muted" style={{ marginTop: -6 }}>
          {question.prompt.slice(0, 120)}{question.prompt.length > 120 ? '…' : ''}
        </p>
        <label htmlFor="flag-reason">Шалтгаан *</label>
        <textarea
          id="flag-reason"
          placeholder="Жишээ: хариулт буруу байх шиг байна / бичвэр тодорхойгүй…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="btn-row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Цуцлах</button>
          <button className="btn" disabled={busy || !reason.trim()} onClick={submit}>
            {busy ? 'Илгээж байна…' : 'Илгээх'}
          </button>
        </div>
      </div>
    </div>
  );
}
