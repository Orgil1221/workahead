import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PaymentView from './PaymentView.jsx';

export default function Payment() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState(null);
  const [plansError, setPlansError] = useState(false);
  const [transactions, setTransactions] = useState(null);
  const [historyError, setHistoryError] = useState(false);
  const [plansRetry, setPlansRetry] = useState(0);
  const [historyRetry, setHistoryRetry] = useState(0);
  const [transactionId, setTransactionId] = useState(null);
  const [checkRetry, setCheckRetry] = useState(0);
  const [verification, setVerification] = useState(null);

  useEffect(() => {
    let alive = true;
    setPlansError(false);
    setPlans(null);
    api('/payments/plans').then((response) => {
      if (alive) setPlans(response.plans);
    }).catch(() => {
      if (alive) setPlansError(true);
    });
    return () => { alive = false; };
  }, [plansRetry]);

  useEffect(() => {
    let alive = true;
    setHistoryError(false);
    setTransactions(null);
    api('/payments/my').then((response) => {
      if (alive) setTransactions(response.transactions);
    }).catch(() => {
      if (alive) setHistoryError(true);
    });
    return () => { alive = false; };
  }, [historyRetry]);

  useEffect(() => {
    if (searchParams.get('payment') !== 'return') return;
    const returnedId = searchParams.get('txn');
    if (returnedId) {
      setTransactionId(returnedId);
      setCheckRetry((value) => value + 1);
    } else {
      setVerification({ type: 'error', message: 'Гүйлгээний мэдээлэл дутуу байна. Гүйлгээний түүхээс төлөвөө шалгана уу.' });
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('payment');
      next.delete('txn');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!transactionId) return;
    let cancelled = false;
    let timer;
    let attempts = 0;
    setVerification({ type: 'checking', message: 'Төлбөрийн баталгаажуулалтыг шалгаж байна…' });

    async function check() {
      attempts += 1;
      try {
        const response = await api('/payments/status/' + encodeURIComponent(transactionId));
        if (cancelled) return;
        const status = response.transaction.status;
        if (status === 'PAID' || status === 'FAILED') {
          setVerification({
            type: status === 'PAID' ? 'success' : 'error',
            message: status === 'PAID' ? 'Төлбөр баталгаажлаа. Таны суралцах эрх идэвхтэй боллоо.' : 'Төлбөр баталгаажаагүй байна. Мөнгө хасагдсан бол тусламжийн дугаарт холбогдоорой.',
          });
          setPlansRetry((value) => value + 1);
          setHistoryRetry((value) => value + 1);
          return;
        }
      } catch {
        if (cancelled) return;
        if (attempts >= 10) {
          setVerification({ type: 'pending', message: 'Одоогоор төлбөрийн төлөвийг шалгаж чадсангүй. Түр хүлээгээд дахин шалгана уу.' });
          return;
        }
      }
      if (attempts >= 10) {
        setVerification({ type: 'pending', message: 'Төлбөрийн баталгаажуулалт хүлээгдэж байна. Дахин төлөхөөс өмнө төлөвөө шалгаарай.' });
        setHistoryRetry((value) => value + 1);
        return;
      }
      timer = setTimeout(check, 1500);
    }

    check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [transactionId, checkRetry]);

  function checkTransaction(nextId) {
    if (!nextId) return;
    setTransactionId(nextId);
    setCheckRetry((value) => value + 1);
  }

  async function checkout(plan) {
    try {
      const response = await api('/payments/checkout', { method: 'POST', body: { planId: plan.id } });
      if (!response.followUpLink) throw new Error('Төлбөрийн холбоос үүссэнгүй. Түр хүлээгээд дахин оролдоно уу.');
      window.location.assign(response.followUpLink);
    } catch (error) {
      if (error.code === 'GATEWAY_NOT_CONFIGURED' || error.code === 'GATEWAY_ERROR') {
        throw new Error('Төлбөрийн үйлчилгээ түр боломжгүй байна. Түр хүлээгээд дахин оролдох эсвэл бидэнтэй холбогдоорой.');
      }
      throw error;
    }
  }

  if (!user) return null;

  return <PaymentView plans={plans} plansError={plansError} transactions={transactions} historyError={historyError}
    onRetryPlans={() => setPlansRetry((value) => value + 1)} onRetryHistory={() => setHistoryRetry((value) => value + 1)}
    verification={verification} onRetryVerification={() => setCheckRetry((value) => value + 1)}
    onCheckTransaction={checkTransaction} onCheckout={checkout} />;
}
