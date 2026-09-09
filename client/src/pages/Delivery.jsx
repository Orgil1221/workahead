export default function Delivery() {
  return (
    <div className="content" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 40px' }}>
      <h1>Хүргэлтийн нөхцөл</h1>
      <p className="small muted">WorkAhead — дижитал үйлчилгээ • www.workahead.me</p>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Хүргэлтийн хэлбэр</h3>
        <p className="small" style={{ lineHeight: 1.7 }}>
          Бүх бүтээгдэхүүн <strong>дижитал эрх</strong> — биет хүргэлт, шуудан, хүргэлтийн хаяг шаардлагагүй.
          Төлбөр амжилттай болмогц (<code>PAID</code>) эрх <strong>автоматаар 0-5 секунд</strong> дотор таны бүртгэлд идэвхжинэ.
          <code>Профайл → Төлбөрийн түүх → PAID • Дуусах: ...</code> гэж харагдана.
        </p>
        <ul className="small" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>Улс/хот/гудамж хаяг шаардлагагүй — <code>Digital — no delivery</code> гэж бүртгэнэ</li>
          <li>Карт эзэмшигчийн гарын үсэг — дижитал баталгаажуулалт (Bonum invoice) -аар орлуулна</li>
          <li>Гүйлгээний баримт: огноо/цаг, дүн (6,999₮), transactionId, хэрэглэгчийн нэр/мэйл/утас, багцын нэр/тоо хэмжээ (1), нийт үнэ автоматаар хадгална</li>
        </ul>
      </div>

      <div className="card">
        <h3>Идэвхжүүлэлт шалгах</h3>
        <ol className="small" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>QPay / Картаар төл → Bonum хуудас → QR/карт баталгаажуул</li>
          <li>Буцах → <code>www.workahead.me/student/profile?payment=return</code> → 3 секунд polling → <code>PAID</code></li>
          <li>Амжилтгүй бол <code>Төлбөрийн түүх</code> -д <code>PENDING/FAILED</code> харагдана — дахин оролдоно уу</li>
        </ol>
      </div>

      <div className="card">
        <h3>Холбоо барих</h3>
        <p className="small" style={{ lineHeight: 1.7 }}>
          Асуудал гарвал: <a href="tel:+97666336691">+976 66336691</a> • <a href="https://www.facebook.com/profile.php?id=100068091317280" target="_blank" rel="noopener noreferrer">Facebook</a>
        </p>
      </div>
    </div>
  );
}
