# Kế Hoạch: Giải Thích Nhanh Thuật Ngữ Trong Markdown Preview

## Mục Tiêu

Thêm tính năng đọc nâng cao: user bôi đen một từ hoặc cụm từ trong phần preview markdown, bấm `Explain`, app sẽ giải thích nhanh thuật ngữ đó dựa trên context xung quanh trong file.

Giải thích cần tập trung vào nghĩa của thuật ngữ trong ngữ cảnh hiện tại, không phải định nghĩa từ điển chung chung.

## Luồng UX Chính

1. User mở một file markdown và chuyển sang preview.
2. User mở một `Explain Viewer` riêng từ preview.
3. User bôi đen một từ hoặc cụm từ trong viewer.
4. App hiện action `Explain` gần vùng chọn hoặc ở bottom action.
5. User bấm `Explain`.
6. App gửi selected text và context xung quanh về backend.
7. Backend gọi LLM provider.
8. App hiển thị giải thích ngắn trong bottom sheet hoặc modal.

## Quyết Định Sản Phẩm Đã Chốt

- Dùng `Explain Viewer` riêng thay vì thay preview tạm thời. Preview đọc bình thường giữ ổn định, còn explain flow có thể dùng WebView selection API.
- Tính năng này yêu cầu login.
- Explanation nên được cache trong backend database, không chỉ cache local. Cách này tránh gọi model lại khi user hỏi cùng term/context ở session hoặc thiết bị khác.
- User không tự chọn provider/API key trong app.
- Code backend cần hỗ trợ 3 provider: OpenAI ưu tiên, Anthropic, Gemini.
- Enforce rate limit ngay từ đầu: 20 lần gọi model/ngày/user.
- User có option renew/regenerate explanation. Renew sẽ bypass cache, gọi model lại và lưu kết quả mới.

## Hướng Kỹ Thuật

Preview hiện tại đang render bằng `react-native-markdown-display`. Trên React Native, text selection không ổn định và không expose đủ thông tin selected text/range trên cả iOS và Android.

Vì vậy, với workflow chọn text và giải thích, nên dùng một `Explain Viewer` riêng bằng WebView. WebView cho phép dùng:

- `window.getSelection()`
- selected text
- selection range
- paragraph/context xung quanh selection
- `postMessage` về React Native

Preview markdown bình thường vẫn có thể giữ nguyên cho luồng đọc thông thường.

## Implementation Mobile

### Explain Viewer

Thêm một icon/button trong preview toolbar:

- Preview bình thường: dùng native markdown preview hiện tại.
- Explain action: mở một WebView viewer riêng tối ưu cho text selection.

### Script Selection Trong WebView

Inject JavaScript để:

- listen `selectionchange`
- đọc `window.getSelection().toString()`
- bỏ qua selection rỗng hoặc quá dài
- lấy context gần selection
- gửi selected text và context về React Native

Payload ví dụ từ WebView về React Native:

```json
{
  "type": "selection",
  "selectedText": "event loop",
  "contextBefore": "...",
  "contextAfter": "...",
  "paragraph": "..."
}
```

### Action Explain

Khi có selected text:

- hiện nút `Explain`
- gọi backend endpoint
- hiện loading state
- hiển thị kết quả trong bottom sheet/modal
- hỗ trợ retry khi lỗi

### UI Kết Quả

Modal/bottom sheet nên hiển thị:

- thuật ngữ đã chọn
- nghĩa ngắn theo context
- giải thích ngắn gọn
- ví dụ hoặc diễn giải lại nếu hữu ích
- confidence nếu cần

Response gợi ý:

```json
{
  "term": "event loop",
  "meaning": "Cơ chế điều phối async work.",
  "explanation": "Trong note này, event loop đang nói về...",
  "example": "Ví dụ...",
  "confidence": "high"
}
```

## Implementation Backend

Thêm FastAPI route:

```http
POST /api/explain-term
```

Request body:

```json
{
  "selected_text": "event loop",
  "context_before": "...",
  "context_after": "...",
  "paragraph": "...",
  "document_title": "async-js-notes.md",
  "language": "vi"
}
```

Response body:

```json
{
  "term": "event loop",
  "meaning": "...",
  "explanation": "...",
  "example": "...",
  "confidence": "high"
}
```

### File Backend Gợi Ý

Thêm:

- `backend/app/routers/explain.py`
- `backend/app/services/explain.py`
- `backend/app/models/explanation.py`
- config mới trong `backend/app/config.py`

Biến môi trường gợi ý:

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-nano
LLM_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
EXPLAIN_DAILY_LIMIT=20
```

Nên đặt provider sau một interface nhỏ để có thể đổi giữa OpenAI, Anthropic và Gemini mà không phải sửa route.

### Data Models

Thêm bảng cache explanation:

```text
ExplanationCache
- id
- user_id
- local_file_id nullable
- document_title nullable
- selected_text
- context_hash
- language
- provider
- model
- meaning
- explanation
- example nullable
- confidence nullable
- created_at
- updated_at
```

Thêm bảng usage theo ngày hoặc log có thể query:

```text
ExplainUsage
- id
- user_id
- date
- count
```

Logic rate limit:

- Check `ExplainUsage` trước khi gọi model.
- Nếu count >= 20 thì trả `429`.
- Cache hit không tính vào daily limit.
- Renew/regenerate có tính vì nó gọi model.

## Prompt Strategy

Prompt cần ép model giải thích theo context và ngắn gọn.

Ví dụ:

```text
You explain selected terms in markdown notes.

Selected term:
{selected_text}

Context:
{context_window}

Rules:
- Explain in Vietnamese.
- Focus on the meaning in this context.
- Do not give every possible dictionary meaning.
- If context is insufficient, say so.
- Be concise.
- Return JSON only with: meaning, explanation, example, confidence.
```

## Trích Xuất Context

Không nên gửi toàn bộ file mặc định.

Context window đề xuất:

- paragraph chứa selection
- một paragraph phía trước
- một paragraph phía sau
- tối đa 3000-5000 ký tự

Cách này giảm chi phí token và giảm rủi ro privacy.

## Lựa Chọn Model

### Default Ưu Tiên: OpenAI GPT-4.1 Nano

Dùng `gpt-4.1-nano` làm default nếu ưu tiên structured output ổn định, hành vi dễ dự đoán và integration đơn giản.

Lý do:

- giá thấp
- instruction following tốt
- JSON/structured output tốt
- phù hợp để làm MVP chắc chắn

Tradeoff:

- không miễn phí

### Provider Thứ Hai: Anthropic Claude Haiku

Thêm Anthropic support phía sau provider interface.

Lý do:

- làm fallback provider tốt
- chất lượng giải thích/ngôn ngữ ổn
- có thể bật sau bằng env config

Tradeoff:

- API shape và response parsing riêng

### Provider Rẻ/Free Tier: Gemini 2.5 Flash-Lite

Dùng `gemini-2.5-flash-lite` làm option rẻ/free-tier.

Lý do:

- có free tier theo docs pricing của Google Gemini API
- paid tier rẻ
- đủ tốt cho giải thích ngắn theo context
- nhanh và hợp với mobile interaction

Tradeoff:

- free tier có thể được provider dùng để cải thiện sản phẩm, tùy điều khoản
- có rate limit

## Privacy

Tính năng này gửi selected text và context xung quanh tới AI provider.

Nên có notice ngắn trước lần dùng đầu tiên:

```text
Selected text and nearby context will be sent to the configured AI provider.
```

Có thể thêm:

- setting để tắt feature
- local-only mode trong tương lai

## Cache

Dùng backend DB cache theo key:

```text
userId + fileId/localFileId + selectedText + contextHash + language
```

Khi có cached explanation, backend trả luôn mà không gọi model.

Renew behavior:

- User có thể bấm `Renew` hoặc `Regenerate`.
- Backend bypass cache.
- Backend check rate limit.
- Backend gọi model và update/insert cache row.

## Scope MVP

Implement trước:

1. Backend route `/api/explain-term`
2. Provider interface với OpenAI, Anthropic và Gemini implementations
3. OpenAI `gpt-4.1-nano` làm default provider
4. WebView `Explain Viewer` riêng
5. Extract selection bằng injected JS
6. Bottom sheet/modal hiển thị explanation
7. Loading/error/retry states cơ bản
8. Privacy notice trước lần dùng đầu tiên
9. Backend DB cache cho explanations
10. Daily rate limit: 20 model calls/user/day
11. Option renew/regenerate

Để sau:

- UI cấu hình provider
- user-owned API key
- lịch sử explanation
- offline/local model
- action nâng cao như `Explain more`, `Simplify`, `Translate`

## Rủi Ro

- Markdown styling trong WebView có thể không giống hoàn toàn native preview.
- Selection UX khác nhau giữa iOS và Android.
- Free tier quota có thể thay đổi.
- Gửi context note ra provider ngoài có thể nhạy cảm.
- LLM có thể hallucinate nếu context yếu, nên response cần có uncertainty handling.

## Quyết Định Đã Chốt

- Explain flow dùng viewer riêng, không thay preview bình thường.
- Bắt buộc login.
- Explanation được cache trong backend DB.
- User không chọn provider/API key trong app.
- Backend hỗ trợ OpenAI, Anthropic và Gemini provider implementations.
- OpenAI là default ưu tiên.
- Enforce rate limit ngay từ đầu: 20 model calls/user/day.
