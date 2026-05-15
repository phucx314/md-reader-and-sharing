# Explain Selected Term From Markdown Preview

## Goal

Add an advanced reading feature that lets users select a word or phrase in markdown preview, tap `Explain`, and receive a short explanation based on the surrounding context.

The explanation should focus on the meaning of the selected term in the current document context, not a generic dictionary definition.

## Core UX

1. User opens a markdown file and switches to preview.
2. User opens a dedicated `Explain Viewer` from preview.
3. User selects a word or phrase in the viewer.
4. App shows an `Explain` action near the selection or as a bottom action.
5. User taps `Explain`.
6. App sends selected text plus nearby context to backend.
7. Backend calls an LLM provider.
8. App shows a concise explanation in a bottom sheet or modal.

## Product Decisions

- Use a dedicated `Explain Viewer` instead of temporarily replacing the normal preview. This keeps the regular preview stable and lets the explain flow use WebView selection APIs without disturbing the main reading experience.
- The feature requires login.
- Explanations should be cached in the backend database, not only in local state. This avoids repeated model calls across sessions/devices for the same user and context.
- The user will not choose provider/API keys in the app.
- Backend provider code should support three provider implementations: OpenAI first, Anthropic second, Gemini third.
- Enforce rate limit from the start: 20 explanation requests per user per day.
- Let users renew/regenerate an explanation. Renew bypasses cache, calls the model again, and stores the new result.

## Technical Direction

The current preview is rendered with `react-native-markdown-display`. React Native text selection is limited and does not reliably expose selected text and selection range across platforms.

For the selection/explain workflow, use a dedicated WebView-based `Explain Viewer`. WebView gives access to:

- `window.getSelection()`
- selected text
- selection range
- surrounding paragraph/context
- `postMessage` back to React Native

The normal markdown preview can remain unchanged for regular reading.

## Mobile Implementation

### Explain Viewer

Add an icon/button in the preview toolbar:

- Normal preview: current native markdown preview.
- Explain action: opens a separate WebView viewer optimized for text selection.

### WebView Selection Script

Inject JavaScript that:

- listens to `selectionchange`
- reads `window.getSelection().toString()`
- ignores empty or very long selections
- finds nearby context around the selection
- posts selected text and context to React Native

Example payload from WebView to React Native:

```json
{
  "type": "selection",
  "selectedText": "event loop",
  "contextBefore": "...",
  "contextAfter": "...",
  "paragraph": "..."
}
```

### Explain Action

When selected text is available:

- show an `Explain` button
- call backend endpoint
- show loading state
- show result in bottom sheet/modal
- support retry on error

### Result UI

The explanation modal should show:

- selected term
- short meaning in context
- concise explanation
- optional example or paraphrase
- confidence indicator if useful

Suggested response fields:

```json
{
  "term": "event loop",
  "meaning": "A mechanism that schedules async work.",
  "explanation": "In this note, event loop refers to...",
  "example": "For example...",
  "confidence": "high"
}
```

## Backend Implementation

Add a FastAPI route:

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

### Backend Files

Suggested additions:

- `backend/app/routers/explain.py`
- `backend/app/services/explain.py`
- `backend/app/models/explanation.py`
- config fields in `backend/app/config.py`

Suggested environment variables:

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-nano
LLM_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
EXPLAIN_DAILY_LIMIT=20
```

Keep the provider behind a small interface so the app can switch between OpenAI, Anthropic, and Gemini without changing the route.

### Data Models

Add an explanation cache table:

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

Add a daily usage table or queryable log:

```text
ExplainUsage
- id
- user_id
- date
- count
```

Rate limit logic:

- Check `ExplainUsage` before model call.
- If count >= 20, return `429`.
- Cached hits should not count against the daily limit.
- Renew/regenerate should count because it calls the model.

## Prompt Strategy

Prompt should make the explanation context-sensitive and concise.

Example:

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

## Context Extraction

Do not send the entire file by default.

Recommended context window:

- selected paragraph
- one paragraph before
- one paragraph after
- max 3000-5000 characters

This keeps cost low and reduces privacy exposure.

## Model Options

### Preferred Default: OpenAI GPT-4.1 Nano

Use `gpt-4.1-nano` as the default if the product prioritizes stable structured output, predictable behavior, and simple integration.

Reasons:

- low price
- good instruction following
- good JSON/structured output behavior
- easiest path for a robust MVP

Tradeoff:

- not free

### Secondary Provider: Anthropic Claude Haiku

Add Anthropic support behind the provider interface.

Reasons:

- useful fallback provider
- good language and explanation quality
- can be enabled later by env config

Tradeoff:

- provider-specific API shape and response parsing

### Cheap/Free-Tier Provider: Gemini 2.5 Flash-Lite

Use `gemini-2.5-flash-lite` as the cheap/free-tier option.

Reasons:

- has a free tier according to Google Gemini API pricing docs
- low paid pricing
- good enough for short contextual explanations
- fast and cheap for mobile interactions

Tradeoff:

- free tier may be used to improve provider products, depending on provider terms
- rate limits apply

## Privacy

This feature sends selected text and surrounding context to an AI provider.

Add a short user-facing notice before first use:

```text
Selected text and nearby context will be sent to the configured AI provider.
```

Consider adding:

- setting to disable the feature
- local-only mode in the future

## Caching

Use backend DB cache by:

```text
userId + fileId/localFileId + selectedText + contextHash + language
```

When a cached explanation exists, return it without calling the model.

Renew behavior:

- User can tap `Renew` or `Regenerate`.
- Backend bypasses cache.
- Backend checks rate limit.
- Backend calls model and updates/inserts cache row.

## MVP Scope

Implement first:

1. Backend route `/api/explain-term`
2. Provider interface with OpenAI, Anthropic, and Gemini implementations
3. OpenAI `gpt-4.1-nano` as default provider
4. Dedicated WebView `Explain Viewer`
5. Selection extraction through injected JS
6. Bottom sheet/modal explanation result
7. Basic loading/error/retry states
8. Small privacy notice before first use
9. Backend DB cache for explanations
10. Daily rate limit: 20 model calls per user per day
11. Renew/regenerate option

Defer:

- provider settings UI
- user-owned API keys
- explanation history
- offline/local model
- advanced follow-up actions such as `Explain more`, `Simplify`, `Translate`

## Risks

- WebView markdown styling may not perfectly match native preview.
- Selection UX differs between iOS and Android.
- Free tier quotas can change.
- Sending note context to an external provider may be sensitive.
- LLM can hallucinate when context is weak, so response should include uncertainty handling.

## Finalized Decisions

- Explain flow uses a separate viewer, not the normal preview.
- Login is required.
- Explanation results are cached in backend DB.
- Users cannot choose provider/API key in the app.
- Backend supports OpenAI, Anthropic, and Gemini provider implementations.
- OpenAI is the preferred default provider.
- Rate limit is enforced from the start: 20 model calls per user per day.
