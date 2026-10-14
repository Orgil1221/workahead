import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import './Payment.css';

const money = (amount) => new Intl.NumberFormat('mn-MN').format(amount) + '₮';
const dateLabel = (value) => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : '—';
};
const icons = {
  card: 'M3 5h18v14H3zM3 10h18M7 15h3',
  check: 'm5 12 4 4L19 6',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  book: 'M12 5v16M3 3c4 0 7 0 9 2 2-2 5-2 9-2v16c-4 0-7 0-9 2-2-2-5-2-9-2V3Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2',
  sparkle: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-5',
  receipt: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h3',
  close: 'm6 6 12 12M6 18 18 6',
  qr: 'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3v3h3v3h-6v-6Zm6-3v2M12 3v3m0 6h3',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3-12a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01',
};

function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name]} /></svg>;
}

function PaymentMethods() {
  return <div className="py-methods"><span><Icon name="qr" size={18} />QPay</span><span><Icon name="card" size={18} />Банкны карт</span></div>;
}

function EmptyState({ error, loading, onRetry, children }) {
  return <div className="py-empty" role={error ? 'alert' : loading ? 'status' : undefined}><span className="py-empty-icon"><Icon name={error ? 'help' : 'receipt'} size={25} /></span><p>{children}</p>{error && <button type="button" className="py-text-button" onClick={onRetry}>Дахин ачаалах <Icon name="arrow" size={16} /></button>}</div>;
}

function CheckoutDialog({ plan, onCheckout, onClose, notice }) {
  const dialogRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await onCheckout(plan);
      onClose();
    } catch (failure) {
      setError(failure.message || 'Төлбөр үүсгэж чадсангүй. Дахин оролдоно уу.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return createPortal(<dialog ref={dialogRef} className="py-checkout" aria-labelledby="py-checkout-title" aria-describedby="py-checkout-description" onCancel={(event) => { event.preventDefault(); if (!submitting.current) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !submitting.current) onClose(); }}>
    <form className="py-checkout-inner" onSubmit={submit} aria-busy={busy}>
      <div className="py-dialog-top"><span className="py-icon-box"><Icon name="card" size={24} /></span><button type="button" className="py-close" aria-label="Хаах" disabled={busy} onClick={onClose}><Icon name="close" /></button></div>
      <p className="py-eyebrow">ТӨЛБӨРИЙН БАТАЛГААЖУУЛАЛТ</p><h2 id="py-checkout-title">Багцаа идэвхжүүлэх</h2><p id="py-checkout-description">Сонгосон багц болон төлөх дүнгээ шалгана уу.</p>
      <div className="py-order"><strong>{plan.title}</strong><dl><div><dt>Хугацаа</dt><dd>{plan.durationDays || 30} хоног</dd></div><div><dt>Шалгалт</dt><dd>{plan.examCount ? `${plan.examCount} шалгалт` : 'Бүх шалгалт'}</dd></div><div className="py-order-total"><dt>Нийт төлөх</dt><dd>{money(plan.priceMnt)}</dd></div></dl></div>
      <PaymentMethods /><p className="py-dialog-note">{notice || 'Үргэлжлүүлэхэд Bonum төлбөрийн хуудас нээгдэнэ. Тэнд QPay эсвэл картаар төлөхөө сонгоорой.'}</p>
      {error && <p className="py-checkout-error" role="alert">{error}</p>}
      <button type="submit" className="py-primary" disabled={busy}>{busy ? 'Төлбөрийн хуудас нээж байна…' : `Төлөх — ${money(plan.priceMnt)}`}{!busy && <Icon name="arrow" size={18} />}</button>
      <button type="button" className="py-cancel" disabled={busy} onClick={onClose}>Буцах</button>
    </form>
  </dialog>, document.body);
}

function TransactionHistory({ transactions, error, onRetry, onCheck, checking }) {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const filtered = (transactions || []).filter((transaction) => filter === 'all' || transaction.status === filter);
  const visible = expanded ? filtered : filtered.slice(0, 5);

  return <section className="py-panel py-history" aria-labelledby="py-history-title">
    <div className="py-section-heading"><div><p className="py-eyebrow">02 / ТӨЛБӨРИЙН МЭДЭЭЛЭЛ</p><h2 id="py-history-title">Гүйлгээний түүх</h2></div><span className="py-history-mark"><Icon name="receipt" size={22} /></span></div>
    {transactions?.length > 0 && <div className="py-filters" aria-label="Гүйлгээ шүүх">{[['all', 'Бүгд'], ['PAID', 'Төлөгдсөн'], ['PENDING', 'Хүлээгдэж буй']].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setExpanded(false); }}>{label}</button>)}</div>}
    {error ? <EmptyState error onRetry={onRetry}>Гүйлгээний түүхийг ачаалж чадсангүй.</EmptyState>
      : transactions === null ? <EmptyState loading>Гүйлгээний түүх ачаалж байна…</EmptyState>
        : filtered.length === 0 ? <EmptyState>{transactions.length ? 'Энэ төлөвтэй гүйлгээ алга.' : 'Одоогоор гүйлгээ алга. Таны төлбөрийн мэдээлэл энд харагдана.'}</EmptyState>
          : <><ul className="py-transactions">{visible.map((transaction) => {
            const paid = transaction.status === 'PAID';
            const pending = transaction.status === 'PENDING';
            const expired = paid && transaction.expiresAt && new Date(transaction.expiresAt).getTime() <= Date.now();
            return <li key={transaction.id} className="py-transaction"><span className={`py-transaction-icon${paid ? ' is-paid' : ''}`}><Icon name={paid ? 'check' : pending ? 'clock' : 'close'} size={18} /></span><div className="py-transaction-info"><strong>{transaction.plan?.title || 'Суралцах багц'}</strong><span>{dateLabel(transaction.createdAt)}{expired ? ' · Эрх дууссан' : ''}</span></div><div className="py-transaction-amount"><strong>{money(transaction.amount)}</strong><span className={`py-status ${paid ? 'is-paid' : pending ? 'is-pending' : 'is-failed'}`}>{paid ? 'Төлөгдсөн' : pending ? 'Хүлээгдэж буй' : 'Амжилтгүй'}</span></div>{pending && transaction.transactionId && <button className="py-check-transaction" type="button" disabled={checking} onClick={() => onCheck(transaction.transactionId)} aria-label={`${transaction.plan?.title || 'Багц'} гүйлгээний төлөв шалгах`}>Шалгах</button>}</li>;
          })}</ul>{filtered.length > 5 && <button type="button" className="py-text-button py-show-more" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? 'Хураах' : `Бусад ${filtered.length - 5} гүйлгээг үзэх`}<Icon name="arrow" size={16} /></button>}</>}
  </section>;
}

export default function PaymentView({ plans, plansError = false, transactions, historyError = false, onRetryPlans, onRetryHistory, verification, onRetryVerification, onCheckTransaction, onCheckout, checkoutNotice }) {
  const [selectedId, setSelectedId] = useState(null);
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const selectedPlan = plans?.find((plan) => plan.id === selectedId) || plans?.find((plan) => plan.owned) || plans?.[0];
  const activePlans = plans?.filter((plan) => plan.owned) || [];
  const checking = verification?.type === 'checking';

  return <div className="student-payment">
    <header className="py-heading"><div><p className="py-eyebrow"><span />БЭЛТГЭЛЭЭ ҮРГЭЛЖЛҮҮЛЭХЭД БЭЛЭН</p><h1>Төлбөр <em>ба багц.</em></h1><p className="py-subtitle">Суралцах эрх, төлбөрийн мэдээллээ нэг дороос удирдаарай.</p></div><span className="py-heading-mark"><Icon name="card" size={26} /></span></header>

    {verification && <div className={`py-verification is-${verification.type}`} role={verification.type === 'error' ? 'alert' : 'status'}><Icon name={verification.type === 'success' ? 'check' : verification.type === 'error' ? 'help' : 'clock'} /><p>{verification.message}</p>{verification.type === 'pending' && <button type="button" className="py-text-button" onClick={onRetryVerification}>Дахин шалгах</button>}</div>}
    {activePlans.map((plan) => <section key={plan.id} className="py-active-plan" aria-label="Идэвхтэй суралцах эрх"><span className="py-active-icon"><Icon name="check" size={19} /></span><div><strong>{plan.title}</strong><p>{plan.expiresAt ? `${dateLabel(plan.expiresAt)} хүртэл идэвхтэй` : 'Таны суралцах эрх идэвхтэй байна'}</p></div><Link to="/student">Шалгалтууд үзэх <Icon name="arrow" size={16} /></Link></section>)}

    <div className="py-layout">
      <div className="py-main">
        <section className="py-panel py-plans" aria-labelledby="py-plans-title">
          <div className="py-section-heading"><div><p className="py-eyebrow">01 / СУРАЛЦАХ БАГЦ</p><h2 id="py-plans-title">Суралцах багцаа сонгох</h2></div><span className="py-small-mark"><Icon name="book" size={22} /></span></div>
          {plansError ? <EmptyState error onRetry={onRetryPlans}>Багцын мэдээллийг ачаалж чадсангүй.</EmptyState>
            : plans === null ? <EmptyState loading>Суралцах багцууд ачаалж байна…</EmptyState>
              : !selectedPlan ? <EmptyState>Шинэ багцууд удахгүй нэмэгдэнэ.</EmptyState>
                : <>
                  {plans.length > 1 && <fieldset className="py-plan-options"><legend>Багцаа сонгох</legend>{plans.map((plan) => <label key={plan.id} className={`py-plan-option${selectedPlan.id === plan.id ? ' is-selected' : ''}`}><input type="radio" name="learning-plan" value={plan.id} checked={selectedPlan.id === plan.id} onChange={() => setSelectedId(plan.id)} /><span><strong>{plan.title}</strong><span>{plan.durationDays || 30} хоног{plan.owned ? ' · Идэвхтэй' : ''}</span></span><b>{money(plan.priceMnt)}</b></label>)}</fieldset>}
                  <div className="py-plan-detail"><div className="py-plan-tags"><span><Icon name="clock" size={14} />{selectedPlan.durationDays || 30} хоног</span><span>{selectedPlan.examCount ? `${selectedPlan.examCount} шалгалт` : 'Бүх шалгалт'}</span>{selectedPlan.owned && <span className="is-owned"><Icon name="check" size={14} />Идэвхтэй</span>}</div><h3>{selectedPlan.title}</h3>{selectedPlan.description && <p className="py-plan-description">{selectedPlan.description}</p>}<div className="py-plan-price"><strong>{money(selectedPlan.priceMnt)}</strong><span>/ {selectedPlan.durationDays || 30} хоног</span></div></div>
                  <ul className="py-benefits"><li><span><Icon name="book" /></span><div><strong>Тест + задгай бодлого</strong><p>Шалгалтын төрлөө сонгож бэлдээрэй.</p></div></li><li><span><Icon name="sparkle" /></span><div><strong>AI үнэлгээ, дэлгэрэнгүй бодолт</strong><p>Алдаагаа ойлгож, дараагийн удаа ахиарай.</p></div></li><li><span><Icon name="clock" /></span><div><strong>Өөрийн хурдаар суралцах</strong><p>{selectedPlan.durationDays || 30} хоногийн турш давтан бэлдэх эрх.</p></div></li></ul>
                </>}
        </section>

        <TransactionHistory transactions={transactions} error={historyError} onRetry={onRetryHistory} onCheck={onCheckTransaction} checking={checking} />
      </div>

      <aside className="py-aside" aria-label="Төлбөрийн хураангуй ба тусламж">
        {selectedPlan && <section className="py-panel py-summary" aria-labelledby="py-summary-title"><div className="py-summary-top"><span className="py-icon-box"><Icon name="receipt" /></span><p className="py-eyebrow">ТАНЫ СОНГОЛТ</p></div><h2 id="py-summary-title">{selectedPlan.owned ? 'Суралцах эрх' : 'Төлбөрийн хураангуй'}</h2><p className="py-summary-plan">{selectedPlan.title}</p><dl><div><dt>Хугацаа</dt><dd>{selectedPlan.durationDays || 30} хоног</dd></div><div><dt>Хандах эрх</dt><dd>{selectedPlan.examCount ? `${selectedPlan.examCount} шалгалт` : 'Бүх шалгалт'}</dd></div>{selectedPlan.owned && <div><dt>Төлөв</dt><dd className="py-owned-label">Идэвхтэй</dd></div>}</dl>{selectedPlan.owned ? <><p className="py-summary-expiry">{selectedPlan.expiresAt ? `${dateLabel(selectedPlan.expiresAt)} хүртэл хүчинтэй.` : 'Та энэ багцын шалгалтуудад хандах эрхтэй.'}</p><Link className="py-primary" to="/student">Суралцаж эхлэх<Icon name="arrow" size={18} /></Link></> : <><div className="py-summary-total"><span>Нийт төлөх</span><strong>{money(selectedPlan.priceMnt)}</strong></div><button type="button" className="py-primary" disabled={checking} onClick={() => setCheckoutPlan(selectedPlan)}>{checking ? 'Баталгаажуулж байна…' : 'Төлбөр төлөх'}<Icon name="arrow" size={18} /></button><PaymentMethods /><p className="py-summary-note"><Icon name="shield" size={14} />Bonum төлбөрийн хуудас нээгдэнэ</p></>}</section>}

        <section className="py-panel py-guide" aria-labelledby="py-guide-title"><h2 id="py-guide-title">Хэрхэн идэвхжүүлэх вэ?</h2><ol><li><span>1</span><div><strong>Багцаа сонгоно</strong><p>Хугацаа, үнийг нь шалгаарай.</p></div></li><li><span>2</span><div><strong>Төлбөрөө төлнө</strong><p>Bonum хуудсанд QPay эсвэл картаар.</p></div></li><li><span>3</span><div><strong>Бэлтгэлээ эхлүүлнэ</strong><p>Төлбөр баталгаажмагц эрх нээгдэнэ.</p></div></li></ol><div className="py-support"><Icon name="help" size={18} /><div><strong>Төлбөртэй холбоотой асуулт байна уу?</strong><a href="tel:+97666336691">+976 66336691</a></div></div></section>
      </aside>
    </div>

    <footer className="py-footer"><span>Work<span>·</span>Ahead</span><Link to="/terms">Үйлчилгээний нөхцөл</Link></footer>
    {checkoutPlan && <CheckoutDialog plan={checkoutPlan} onCheckout={onCheckout} onClose={() => setCheckoutPlan(null)} notice={checkoutNotice} />}
  </div>;
}
