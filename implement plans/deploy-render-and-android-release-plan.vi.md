# Kế Hoạch Deploy Backend lên Render và Xuất APK Release

## 1) Mục tiêu
- Deploy backend FastAPI (`backend/`) lên Render.
- Trỏ mobile app về backend production URL.
- Build APK release để cài trực tiếp trên Android.
- Ghi rõ rủi ro hiện tại của DB local (SQLite) và hướng nâng cấp.

## 2) Trạng thái hiện tại của codebase
- Backend đang chạy FastAPI app tại `app.main:app`.
- DB hiện tại là SQLite local file `backend/database.db` (khai báo trong `backend/app/database.py`).
- Mobile đang đọc base URL từ `EXPO_PUBLIC_API_URL`.
- App mobile dùng Expo managed workflow.

## 3) Plan triển khai backend lên Render

### Bước 3.1: Chuẩn bị dependency backend
- Tạo/chuẩn hóa `backend/requirements.txt`.
- Đảm bảo có đủ package backend đang dùng:
  - `fastapi`
  - `uvicorn[standard]`
  - `sqlmodel`
  - `SQLAlchemy`
  - `python-dotenv`
  - `PyJWT`
  - `bcrypt`
  - `python-multipart`
  - `email-validator`
  - `markdown`
  - `aiofiles`

### Bước 3.2: Tạo Web Service trên Render
- Tạo service kiểu **Web Service** từ GitHub repo.
- Cấu hình:
  - **Root Directory**: `backend`
  - **Build Command**: `pip install -U pip && pip install -r requirements.txt`
  - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Bước 3.3: Cấu hình biến môi trường trên Render
- Bắt buộc:
  - `SECRET_KEY`
  - `EXPLAIN_DAILY_LIMIT=20`
- Nếu dùng MiMo theo OpenAI-compatible:
  - `LLM_PROVIDER=openai`
  - `OPENAI_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1`
  - `OPENAI_API_KEY=<your_key>`
  - `OPENAI_MODEL=MiMo-V2.5` (hoặc model id thực tế)
- Nếu dùng MiMo theo Anthropic-compatible:
  - `LLM_PROVIDER=anthropic`
  - `ANTHROPIC_BASE_URL=https://token-plan-sgp.xiaomimimo.com/anthropic`
  - `ANTHROPIC_API_KEY=<your_key>`
  - `ANTHROPIC_MODEL=MiMo-V2.5`

### Bước 3.4: Verify sau deploy
- Check endpoint health:
  - `GET /` trả message welcome.
- Test login flow.
- Test explain flow:
  - request đầu `cached=false`
  - request lặp `cached=true` (khi hit cache)

## 4) Plan DB (hiện tại vs production-ready)

### 4.1 Hiện tại
- Dùng SQLite local file `database.db`.
- Nếu Render không có persistent disk thì restart/deploy có thể mất data.

### 4.2 Giai đoạn tạm ổn
- Gắn persistent disk cho service để giữ `database.db` và `uploads`.
- Chấp nhận giới hạn concurrency/scale của SQLite.

### 4.3 Giai đoạn production chuẩn
- Migrate sang Render Postgres.
- Refactor `app/database.py` đọc `DATABASE_URL` từ env.
- Thêm migration tool (Alembic hoặc SQLModel migration workflow).

## 5) Plan xuất Android APK release (Expo EAS)

### Bước 5.1: Chuẩn bị project mobile
- Cài EAS CLI: `npm i -g eas-cli`
- Login: `eas login`
- Trong `mobile/app.json`, set Android package id:
  - ví dụ: `com.yourname.mdreader`

### Bước 5.2: Tạo `eas.json`
- Thêm profile `preview` build APK:
  - `android.buildType = apk`
- Profile `production` nên để `app-bundle` cho Play Store.

### Bước 5.3: Trỏ mobile về backend production
- Set `mobile/.env`:
  - `EXPO_PUBLIC_API_URL=https://<service-name>.onrender.com`

### Bước 5.4: Build APK
- Chạy:
  - `cd mobile`
  - `eas build -p android --profile preview`
- Lấy link artifact APK từ EAS dashboard.

## 6) Checklist thực thi
- [ ] Tạo `requirements.txt` backend nếu còn thiếu.
- [ ] Tạo Render Web Service + env vars.
- [ ] Deploy thành công, test API root/auth/explain.
- [ ] Cấu hình `EXPO_PUBLIC_API_URL` cho mobile.
- [ ] Cấu hình `app.json` package id + `eas.json`.
- [ ] Build APK profile preview và kiểm thử trên thiết bị thật.

## 7) Rủi ro và lưu ý
- SQLite phù hợp MVP nhưng không tối ưu khi traffic tăng.
- Nếu dùng free tier Render, cold start có thể làm request đầu chậm.
- Cần rotate API keys định kỳ và không hardcode key trong app.
