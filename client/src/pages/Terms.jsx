export default function Terms() {
  return (
    <div className="content" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 40px' }}>
      <h1>Үйлчилгээний нөхцөл ба Гэрээ</h1>
      <p className="small muted">Сүүлд шинэчилсэн: 2026-09-08 • WorkAhead • www.workahead.me</p>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>1. Бидний тухай</h3>
        <p className="small" style={{ lineHeight: 1.6 }}>
          <strong>WorkAhead</strong> нь Монголын их, дээд сургуулийн оюутнуудад зориулсан онлайн шалгалтын бэлтгэл платформ юм.
          Бид Математик 1Б, Интеграл, Хязгаар, Цуваа зэрэг хичээлүүдийн улирал/явцын шалгалтын материал, AI үнэлгээ, тайлбарыг санал болгодог.
          Үйлчилгээ бүрэн онлайн, биет хүргэлтгүй.
        </p>
        <p className="small muted">Холбоо барих: <a href="tel:+97666336691">+976 66336691</a> • <a href="https://www.facebook.com/profile.php?id=100068091317280" target="_blank" rel="noopener noreferrer">Facebook</a> • info@workahead.me</p>
      </div>

      <div className="card">
        <h3>2. Бүтээгдэхүүн, үйлчилгээ, үнэ</h3>
        <ul className="small" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li><strong>30 хоногийн багц — 6,999₮</strong> : Нэг багцад тухайн хичээлийн бүх шалгалт (10-15 асуулт), Задгай (бичгээр) + Тест (4 сонголт, байрлал random), AI үнэлгээ, дэлгэрэнгүй бодолт багтана.</li>
          <li>Нийт үнэ төлбөрийн шатанд <strong>ил тод</strong> харагдана — нэмэлт шимтгэлгүй. Bonum-аар дамжин QPay, SocialPay, карт (Visa/Master/UnionPay) хүлээн авна.</li>
          <li>Үнэ, багцын агуулга <code>Профайл → Багц, төлбөр</code> хэсэгт үргэлж шинэчлэгдэнэ.</li>
        </ul>
      </div>

      <div className="card">
        <h3>3. Төлбөр, баталгаажуулалт</h3>
        <ul className="small" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>Төлбөр амжилттай болмогц эрх <strong>0-5 секунд</strong> дотор автоматаар идэвхжиж, 30 хоног тоологдоно. <code>Профайл → Төлбөрийн түүх</code> -д <code>PAID • Дуусах: ...</code> гэж харагдана.</li>
          <li>Bonum-аас <code>x-checksum-v2</code> HMAC баталгаажуулалт хийж, <code>transactionId, invoiceId, amount</code> хадгална.</li>
          <li>Өдрийн гүйлгээний хязгаар: <strong>200 гүйлгээ / 1,399,800₮</strong> — хязгаар хүрвэл маргааш дахин оролдоно уу.</li>
        </ul>
      </div>

      <div className="card">
        <h3>4. Хүргэлт ба ашиглалт</h3>
        <p className="small" style={{ lineHeight: 1.7 }}>
          Биет хүргэлтгүй — дижитал хандалт. Төлбөр баталгаажсан даруйд <code>www.workahead.me/student</code> нэвтэрч бүх шалгалт нээгдэнэ.
          Хүргэлтийн хаяг шаардлагагүй, <code>Digital — no delivery</code> гэж бүртгэнэ.
        </p>
      </div>

      <div className="card">
        <h3>5. Эрсдэлээс урьдчилан сэргийлэх, луйврын хяналт</h3>
        <ul className="small" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>Сэжигтэй гүйлгээг илрүүлэх модуль: IP 20/цаг, хэрэглэгч 5/10мин, давхар transactionId, өдрийн дүн/тоо хязгаар шалгана, `REVIEW` төлөвт оруулж админ шалгана.</li>
          <li>Сайн хэрэглэгчийг тодорхойлох, сүлжээний луйврыг тогтмол хянаж, захиалгыг гүйцэтгэхээс өмнө хяналт хийнэ.</li>
          <li>Бонумтай нягт хамтран ажиллаж, маргаан/зөрчлийг 5 хоногт шийдвэрлэнэ — <code>disputes@workahead.me</code>.</li>
        </ul>
      </div>

      <div className="card">
        <h3>6. Хэрэглэгчийн мэдээлэл аюулгүй хадгалалт</h3>
        <p className="small" style={{ lineHeight: 1.7 }}>
          Нууц үг <code>bcrypt</code> hash, JWT `httpOnly` cookie, `helmet` + `CSRF` хамгаалалттай. Картын мэдээлэл манайд хадгалагдахгүй — Bonum-д дамжуулна.
          Гүйлгээний баримт (нэр, утас, мэйл, огноо/цаг, дүн, transactionId, total) 10 жил хадгална.
        </p>
      </div>

      <div className="card">
        <h3>7. Холбоо барих</h3>
        <p className="small" style={{ lineHeight: 1.7 }}>
          Хаяг: Улаанбаатар, Сүхбаатар дүүрэг (онлайн үйлчилгээ, оффисгүй)<br />
          Утас: <a href="tel:+97666336691">+976 66336691</a> — дархад шууд залгана<br />
          Facebook: <a href="https://www.facebook.com/profile.php?id=100068091317280" target="_blank" rel="noopener noreferrer">facebook.com/profile.php?id=100068091317280</a><br />
          Мэйл: info@workahead.me
        </p>
      </div>

      <p className="small faint" style={{ textAlign: 'center', marginTop: 18 }}>© 2026 WorkAhead • Бүх эрх хуулиар хамгаалагдсан</p>
    </div>
  );
}
