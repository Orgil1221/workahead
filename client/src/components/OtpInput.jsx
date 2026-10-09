import { useEffect, useRef } from 'react';

// 6 тусдаа дугуйрсан хайрцагтай OTP оруулах — автоматаар урагшлах,
// Backspace-ээр ухрах, paste хийхэд бүх хайрцаг бөглөнө.
export default function OtpInput({ value = '', onChange, length = 6, disabled = false, autoFocus = true }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && !disabled) refs.current[0]?.focus();
  }, [disabled, autoFocus]);

  const emit = (arr) => onChange(arr.join('').slice(0, length));

  const handleChange = (i, raw) => {
    const ch = (raw || '').replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = ch;
    emit(next);
    if (ch && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits];
        next[i] = '';
        emit(next);
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        const next = [...digits];
        next[i - 1] = '';
        emit(next);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, length);
    if (!text) return;
    const next = Array.from({ length }, (_, i) => text[i] || '');
    emit(next);
    refs.current[Math.min(text.length, length - 1)]?.focus();
  };

  return (
    <div className="otp-boxes" onPaste={handlePaste} role="group" aria-label="OTP код">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className="otp-box mono"
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`Орон ${i + 1}`}
        />
      ))}
    </div>
  );
}
