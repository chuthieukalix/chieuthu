# Website chieuthu.com — Hướng dẫn

Website tĩnh sinh từ vault Obsidian bằng [Quartz v5](https://quartz.jzhao.xyz).

---

## 🔒 Nguyên tắc: chỉ bài được gắn cờ mới lên web

Note **không** có `publish: true` sẽ **không bao giờ** ra khỏi máy bạn. Có 2 lớp chặn độc lập:

| Lớp | Cơ chế | Chặn cái gì |
|---|---|---|
| 1 | `sync-publish.mjs` | Chỉ copy note có `publish: true` sang `content/`. Note khác **không vào repo, không lên GitHub** |
| 2 | Plugin `explicit-publish` | Kể cả file lọt vào `content/`, Quartz vẫn không render nếu thiếu cờ |

Thêm nữa, các thư mục sau **luôn bị chặn**, kể cả khi note bên trong có gắn cờ:
`1.CAPTURE`, `99.KALIX SYSTEM`, `_agent`, `Clippings`, `.obsidian`

---

## ✍️ Cách đăng một bài

**Bước 1** — Mở note trong Obsidian, thêm `publish: true` vào frontmatter:

```yaml
---
title: Tên bài của bạn
publish: true      # ← dòng này quyết định
tags: [chu-de]
---
```

**Bước 2** — Chạy:

```bash
cd ~/dev/chieuthu-site
./dang-bai.sh
```

Script sẽ: lọc bài → build thử → cho bạn xem thay đổi → hỏi xác nhận → đẩy lên.
Web cập nhật sau ~1–2 phút.

**Gỡ bài xuống:** xoá dòng `publish: true` rồi chạy lại `./dang-bai.sh`.

---

## 👀 Xem thử trước khi đăng

```bash
npm run dev
```

Mở http://localhost:8080. Đây là bản local, chưa ai thấy được.

---

## 🛠️ Cần bạn tự làm 1 lần (tôi không đăng nhập tài khoản thay bạn được)

### A. Tạo repo GitHub

✅ **Đã xong** — repo: https://github.com/chuthieukalix/chieuthu

### B. Bật GitHub Pages

Trong repo → **Settings** → **Pages** → mục *Build and deployment* → **Source: GitHub Actions**.

> Repo Private vẫn deploy được ra web public, miễn là tài khoản GitHub Free có bật Pages cho private repo. Nếu GitHub báo cần Pro, đổi repo sang Public — nội dung nhạy cảm vẫn an toàn vì `content/` chỉ chứa bài bạn đã duyệt.

### C. Trỏ domain chieuthu.com về GitHub Pages

Vào Namecheap → **Domain List** → `chieuthu.com` → **Manage** → **Advanced DNS**.
Xoá các bản ghi A/CNAME cũ trỏ về parking, rồi thêm:

| Type | Host | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `chuthieukalix.github.io.` |

Sau đó trong repo → **Settings** → **Pages** → **Custom domain** → nhập `chieuthu.com` → Save → chờ SSL cấp xong (vài phút đến 1 tiếng) → tick **Enforce HTTPS**.

> File `public/CNAME` đã được Quartz tự sinh sẵn từ `baseUrl` trong config — bạn không phải tạo tay.

### D. ⚠️ Đổi mật khẩu

Bạn đã dán mật khẩu Namecheap và Contabo vào chat. Đổi cả hai và bật 2FA. Nếu dùng chung pass ở nơi khác, đổi luôn.

---

## ⚙️ Chỉnh giao diện

Mở `quartz.config.yaml`:

- `pageTitle` — tên hiện ở góc trái
- `theme.colors` — bảng màu sáng/tối
- `theme.typography` — font chữ
- `plugins` — bật/tắt graph view, search, backlinks, mục lục…

Sau khi sửa, chạy `npm run dev` để xem trước.

---

## 📁 Cấu trúc

```
chieuthu-site/
├── sync-publish.mjs      ← script lọc bài (tự viết)
├── dang-bai.sh           ← lệnh đăng bài (tự viết)
├── quartz.config.yaml    ← cấu hình site
├── content/              ← bài đã lọc, CHỈ chứa bài publish: true
├── .github/workflows/    ← tự build + deploy khi push
└── quartz/               ← lõi Quartz, đừng sửa
```

---

## 🩹 Sự cố thường gặp

**Bài không lên web** — kiểm tra `publish: true` nằm trong khối `---` ở đầu file, viết đúng chữ thường, không thừa dấu nháy.

**Script báo "TRÙNG TÊN FILE"** — hai note khác thư mục nhưng cùng tên file. Đổi tên một cái, vì web làm phẳng cấu trúc thư mục.

**Script báo "wikilink trỏ sang note CHƯA publish"** — bài của bạn link tới bài chưa công khai, trên web sẽ thành link gãy. Hoặc gắn `publish: true` cho bài đích, hoặc bỏ link đi.

**Actions đỏ trên GitHub** — mở tab Actions, bấm vào lần chạy lỗi để xem log.
