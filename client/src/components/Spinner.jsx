export default function Spinner({ text = 'Ачааллаж байна' }) {
  return (
    <div className="loader" role="status" aria-label={text}>
      <span className="loader-stamp" aria-hidden="true">W·A</span>
      <span className="loader-text">{text}…</span>
    </div>
  );
}
