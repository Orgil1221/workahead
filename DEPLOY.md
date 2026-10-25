# 🚀 Work Ahead — Интернетэд байршуулах гарын авлага

**Архитектур ($0/сар):** Vercel (frontend) → Render Free (backend) → Neon (Postgres)

---

## 1️⃣ Neon — Үнэгүй Postgres (3 мин)

1. https://neon.tech → **Sign up with GitHub** (Orgil1221-ээр)
2. Project name: `work-ahead` → Create
3. Connection string хуулах (хэлбэр: `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)
4. ⚠️ Энэ URL-г **Render-ийн `DATABASE_URL`-д** ашиглана

## 2️⃣ Render — Backend (5 мин)

1. https://render.com → **Get Started → Sign in with GitHub** (Orgil1221-ээр)
2. **New + → Web Service** → GitHub repo `Orgil1221/workahead` → Connect
3. Тохиргоо:
   - **Name:** `work-ahead-api` ⚠️ (энэ нэр чухал — доорх vercel.json-той таарна)
   - **Region:** Singapore
   - **Runtime:** Docker (автоматаар Dockerfile олдоно)
   - **Instance Type:** Free
4. **Environment Variables** — дараахыг нэг нэгээр нь нэм:

| Key | Value |
|---|---|
| `DATABASE_URL` | Neon-оос авсан URL (шинэхэн хэлбэр) |
| `JWT_SECRET` | 64 оронтой санамсаргүй тэмдэгт (доорх команд үүсгэнэ) |
| `CSRF_SECRET` | Өөр нэг санамсаргүй тэмдэгт |
| `OTP_HASH_SECRET` | OTP hash-д ашиглах тусдаа, санамсаргүй 64 тэмдэгт secret |
| `NODE_ENV` | `production` |
| `PUBLIC_BASE_URL` | `https://workahead.me` (өмнө `https://workahead.vercel.app` байсан) — 4️⃣ хийсний дараа нэм |
| `CORS_ORIGIN` | `https://workahead.me,https://www.workahead.me` |
| `BONUM_API_BASE_URL` | `https://testapi.bonum.mn` |
| `BONUM_APP_SECRET` | Одоогийн .env дэх утга |
| `BONUM_TERMINAL_ID` | Одоогийн .env дэх утга |
| `BONUM_CHECKSUM_KEY` | Одоогийн .env дэх утга |
| `GEMINI_API_KEY` | Одоогийн .env дэх утга |
| `GEMINI_MODEL` | `gemini-3.6-flash` |

💡 Түлхүүр бүрд тусад нь криптографын санамсаргүй утга үүсгэ: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Үр дүнг зөвхөн hosting-ийн secret тохиргоонд оруул; repository эсвэл чатад бүү хуул.

5. **Create Web Service** дарах → build log харагдана (2-3 мин) → `https://work-ahead-api.onrender.com/api/health` → `{"ok":true}` буух ёстой
6. **Өгөгдлийн сан:** API container эхлэх үед Prisma schema нэмэлтээр шинэчлэгдэнэ. Шинэ schema өөрчлөлт өгөгдөл устгах шаардлагатай бол startup алдаагаар зогсоно; `--accept-data-loss` ашиглан хүчээр ажиллуулахгүй.
7. **Seed админ:** `SEED_ADMIN_EMAIL` болон `SEED_ADMIN_PASSWORD`-ийг зөвхөн Render-ийн нууц Environment Variables-д тохируулж байж `node prisma/seed.js` ажиллуул. Нууц үг 16-аас доошгүй тэмдэгт, бусад газарт ашиглаагүй байна. Урьдчилсан demo `admin@workahead.mn / admin123` бүртгэл үүсгэхгүй.
8. **Админы хоёр дахь баталгаажуулалт:** Render дээр Resend, Brevo эсвэл SMTP provider-ийн нууцыг тохируул. Код зөвхөн `L.monhorgil2007@gmail.com` руу очиж **10 минут** хүчинтэй байна. Зөв кодоор баталгаажсан **тухайн браузер** 24 цаг дахин код шаардахгүй; өөр браузер дээр шинэ код шаардлагатай. Буруу код 5 удаа оруулахад хүчингүй болно. Шинэ код авах хооронд 60 секунд, 15 минутад дээд тал нь 5 илгээлт зөвшөөрнө. Provider ажиллахгүй үед шинэ баталгаажуулалт амжилтгүй болно.
9. **Rate limit:** олон instance/process ашиглах үед Render/Upstash Redis URL-ийг `REDIS_URL` болгон тохируул. Redis-гүй үед limiter process дотор ажиллах тул олон instance хооронд нэгдсэн хамгаалалт баталгаатай биш.
10. **Security rollout:** эхлээд backup болон schema шинэчлэлээ баталгаажуул. API болон client-ийн шинэ хувилбар хоорондоо таарах ёстой: login/logout/seed бүгд CSRF token шаарддаг. Өмнөх админ сессүүд дахин нэвтрэх шаардлагатай. SQL, локал тест, үлдсэн хязгаарлалтыг `docs/SECURITY.md`-ээс үз.

## 3️⃣ Vercel — Frontend (3 мин)

1. https://vercel.com → **Sign up with GitHub**
2. **Add New → Project** → `workahead` repo → Import
3. **Framework Preset:** Vite (автоматаар) — бусад зүйл хамаагүй (vercel.json тохиргоог уншина)
4. ⚠️ **Deploy дарахын өмнө:** `client/vercel.json` доторх Render URL баталгаажсан эсэхийг шалга — Render-ийн Name өөр байвал тэр хаяг руу зас
5. Deploy → таны сайт: `https://workahead-xxx.vercel.app`

## 4️⃣ Холболт ба эцсийн тохиргоо — workahead.me

1. **Vercel → Domains:** `workahead.me` + `www.workahead.me` нэм → заасан DNS-ийг Namecheap-д хуулах (доорх 3.5-г үз)
2. **Namecheap → Advanced DNS:** `Type A | Host @ | Value 76.76.21.21` + `CNAME | Host www | Value cname.vercel-dns.com` (Vercel-ээс өгсөн утга баталгаажуулах). 5-10 мин хүлээ.
3. Render → `PUBLIC_BASE_URL=https://workahead.me` + `CORS_ORIGIN=https://workahead.me,https://www.workahead.me` → **Save** (авто redeploy)
4. **UptimeRobot** (https://uptimerobot.com, үнэгүй): Add New Monitor → HTTP(s) → Render-ийн `/api/health` URL → 5 мин интервал — сервис унтахгүй байлгана
5. Bonum webhook (тест болвол): тэдгээрийн dashboard дээр callback URL → `https://work-ahead-api.onrender.com/api/payments/webhook` (домэйн сольсон ч webhook Render API дээр хэвээр)

## 5️⃣ Шалгах жагсаалт

- [ ] `https://…vercel.app` нээгдэж, нүүр харагдаж байна
- [ ] Бүртгүүлэх → салбар сургууль/мэргэжил сонгож бүртгүүлэв
- [ ] Тест эхлүүлж асуулт хариулж дуусгав
- [ ] Админ нэвтрэхдээ нууц үг болон имэйлээр ирсэн 6 оронтой кодоо ашиглах

## 🔐 Аюулгүй байдлын жортой зүйлс

- ❗ `RATE_LIMIT_DISABLED` — production env-д **бүү нэм** (local .env дээр л байгаа, GitHub-д ороогүй)
- ❗ Демо хэрэглэгчид (`admin@workahead.mn`, `student@workahead.mn`) seed хийсэн бол Render Shell дээр `node scripts/remove-demo-users.mjs`
- ❗ Neon дээр backup/PITR тохиргоог тусад нь шалгаж, сэргээх туршилт хий. Аппын код DB backup-ийг орлохгүй.
- ❗ Bonum production түлхүүр авахдаа env-үүдийг нээр нь солих
