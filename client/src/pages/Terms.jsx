export default function Terms() {
  return (
    <div className="content" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 40px' }}>
      <h1>Үйлчилгээний нөхцөл</h1>
      <p className="small muted">Сүүлд шинэчилсэн: 2026-10-16 • WorkAhead • www.workahead.me</p>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>1. Бидний тухай</h3>
        <p className="small" style={{ lineHeight: 1.7 }}>
          <strong>WorkAhead</strong> нь Монголын их, дээд сургуулийн оюутнуудад зориулсан
          шалгалтын бэлтгэлийн онлайн платформ юм.
        </p>
      </div>

      <div className="card">
        <h3>2. Манай үйлчилгээ</h3>
        <ul className="small" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>Хичээл тус бүрээр улирал, явцын шалгалтын сан</li>
          <li>Задгай даалгавар + Тест (4 сонголт) гэсэн 2 горим</li>
          <li>Асуулт бүрд иж бүрэн бодолт, зөв хариулт</li>
          <li>Задгай бодолтод AI үнэлгээ, оноо, тайлбар</li>
          <li>Сэдвийн ахиц, дүнгийн түүх, bookmark</li>
        </ul>
      </div>

      <div className="card">
        <h3>3. Багц ба төлбөр</h3>
        <ul className="small" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li><strong>30 хоногийн багц — 6,999₮</strong>: бүх шалгалт, AI үнэлгээ багтана.</li>
          <li>Төлбөрийг QPay болон банкаар Bonum гарцаар хүлээн авна.</li>
          <li>Төлбөр баталгаажсан даруйд эрх таны бүртгэлд автоматаар нээгдэнэ.</li>
          <li>Үйлчилгээ бүрэн дижитал — биет хүргэлт байхгүй.</li>
        </ul>
      </div>

      <div className="card">
        <h3>4. Холбоо барих</h3>
        <p className="small" style={{ lineHeight: 1.7 }}>
          Утас: <a href="tel:+97666336691">+976 66336691</a><br />
          Facebook: <a href="https://www.facebook.com/profile.php?id=100068091317280" target="_blank" rel="noopener noreferrer">WorkAhead</a><br />
          Мэйл: info@workahead.me
        </p>
      </div>

      <div className="card">
        <h3>5. Ашиглалтын хугацааны хэмжилт</h3>
        <p className="small" style={{ lineHeight: 1.7 }}>Үйлчилгээний ачаалал, ашиглалтыг ойлгохын тулд нэвтэрсэн оюутны идэвхтэй хугацааг бүртгэлтэй нь холбон хэмжинэ. Харагдаж буй, фокустай tab дээрх хугацааг тоолж, 2 минут үйлдэлгүй бол түр зогсооно. Давхар tab, төхөөрөмжийн давхцсан хугацааг нэг удаа тоолно.</p>
        <p className="small" style={{ lineHeight: 1.7 }}>Энэ хэмжилтэд бичсэн текст, товчлуурын утга, дэлгэцийн зураг, хуудасны агуулгыг хадгалахгүй. Админд өдөр, цагийн нэгтгэл харагдана. Хугацааны дэлгэрэнгүй бүртгэлийг 35 хоног хадгалж, өдөр тутмын цэвэрлэгээгээр устгана. Өмнөх ашиглалтыг таамгаар нөхөхгүй.</p>
      </div>
      <p className="small faint" style={{ textAlign: 'center', marginTop: 18 }}>© 2026 WorkAhead • Бүх эрх хуулиар хамгаалагдсан</p>
    </div>
  );
}
