# Work Ahead — Шалгалтын бэлтгэлийн платформ

Монголын их сургуулиудын улирлын / midterm шалгалтад зориулсан бэлтгэлийн систем.

- **Frontend**: React (Vite), mobile-first — desktop дээр sidebar, mobile дээр bottom tab bar.
  Фонт: Fraunces (heading) · IBM Plex Mono (тоо/код) · Inter (body). Цаас/бэхний палитр.
- **Backend**: Node.js + Express, REST API, JWT auth (ADMIN / STUDENT роль).
- **DB**: PostgreSQL + Prisma ORM.

## Бүтэц

```
shalgaltad-beldeh-system/
├── files/                     # Импорт форматтай жишээ асуултын файлууд
│   ├── math1b-2019-import.json
│   ├── math1b-2023-import.json
│   └── math1b-2024-import.json
├── server/
│   ├── prisma/
│   │   ├── schema.prisma      # University → Program → Exam → Question + Flag,
│   │   │                      # Bookmark, TestAttempt, AttemptAnswer, Notification
│   │   └── seed.js            # Админ/оюутан хэрэглэгч үүсгэж files/*.json-ыг импортлоно
│   ├── scripts/import.js      # Standalone JSON импортер
│   └── src/
│       ├── index.js           # Express app
│       ├── db.js              # Prisma client
│       ├── middleware/auth.js # requireAuth / requireAdmin
│       ├── services/importService.js
│       └── routes/
│           ├── auth.js        # register / login / me
│           ├── catalog.js     # Сургууль → Хөтөлбөр → Шалгалт drill-down
│           ├── exams.js       # Шалгалт дэлгэрэнгүй + solution lookup
│           ├── attempts.js    # Тест эхлүүлэх/хариулах/дуусгах, history, topic progress
│           ├── bookmarks.js   # Bookmark CRUD
│           ├── flags.js       # Student flag илгээх + Admin reports queue
│           ├── notifications.js
│           └── admin/
│               ├── catalog.js # University/Program/Exam/Question CRUD + reorder + шүүлт
│               ├── import.js  # Content Import (file upload / raw paste)
│               ├── stats.js   # Статистик: их flagтай асуулт, сул сэдэв, идэвхтэй хэрэглэгч
│               └── users.js   # Хэрэглэгчийн удирдлага
└── client/
    └── src/
        ├── pages/admin/       # Dashboard, Catalog, Questions, Import, Reports, Users, Notify
        ├── pages/student/     # Home, University, Program, ExamDetail, AttemptRunner,
        │                      # Dashboard (график), Bookmarks, History, Notifications
        └── components/        # Layouts, TabBar, FlagModal, Spinner
```

## Импорт файлын формат (`files/*.json`)

```json
{
  "exam_id": "math1b-2024-fall-variant1",
  "title": "Математик 1Б — Явцын шалгалт (2024)",
  "source": "2024 оны бодит явцын шалгалт",
  "year": 2024,
  "variant": "Variant 1",
  "questions": [
    {
      "type": "open",
      "prompt": "Асуултын бүрэн текст…",
      "model_solution": "Иж бүрэн шийдэл…",
      "answer": "Эцсийн хариулт",
      "points": 3,
      "needs_review": true,
      "tags": ["сэдэв", "дэд сэдэв"]
    }
  ]
}
```

Ижил `exam_id`-тай дахин импортловал шалгалт шинэчлэгдэн, асуултууд нь орлож бүтэнэ.

## Суулгах

### 0. PostgreSQL

Локал Postgres эсвэл cloud (Neon, Supabase г.м.) ашиглана.
Жишээ нь Docker-ээр:

```bash
docker run -d --name workahead-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=workahead -p 5432:5432 postgres:16
```

### 1. Server

```bash
cd server
cp .env.example .env        # DATABASE_URL, JWT_SECRET засана
npm install
npm run db:push             # schema-г DB рүү түлхэнэ
npm run seed                # demo хэрэглэгчид + files/*.json импорт
npm run dev                 # http://localhost:4000
```

Demo бүртгэл (зөвхөн локал `npm run seed` дараа):
- `seed.js` 2 demo хэрэглэгч үүсгэнэ — production-д **шууд идэвхгүй болгож, нууц үгээ солино уу** (доорх Аюулгүй байдал харна уу).

Гар файлаас гараар импортлох:

```bash
node scripts/import.js ../files/math1b-2024-import.json --program=<programId>
```

### 2. Client

```bash
cd client
npm install
npm run dev                 # http://localhost:5173 (API proxy: :4000)
```

## Холболт (Admin ↔ Student)

- Оюутан flag илгээх → Админий **Reports** queue-д `ШИНЭ` төлөвтэй орно; админ асуултыг шууд засаж, flag-уудыг `ШИЙДВЭРЛЭСЭН` болгоно.
- Админ мэдэгдэл илгээх → сонгосон хөтөлбөрийг хадгалсан оюутнуудын in-app мэдэгдэл рүү очно.
- Админ статистикт оюутны гүйцэтгэл **anonymized** нэгтгэлээр (topic-level %) ашиглагдана.
