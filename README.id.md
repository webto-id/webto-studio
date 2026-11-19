# webto-studio

**Sistem pengembangan website agentik. Ubah asisten AI coding Anda menjadi
studio website lengkap.**

Buka folder ini di Claude Code, Cursor, Codex, atau agen coding lain, minta
dibuatkan website, dan agen menjalankan alur produksi: mewawancarai,
mendesain setiap bagian, membangun, memeriksa hasilnya sendiri, lalu
menerbitkannya ke [webto.id](https://webto.id). Situs di-hosting di sana dan
klien mengeditnya lewat editor visual.

Section ditulis dalam subset Astro dengan Tailwind. Animasi dan 3D memakai
GSAP, WebGL (OGL), dan three.js yang disediakan platform, sehingga halaman
bisa membawa model `.glb` yang berputar saat digulir tanpa build sendiri.

English: [README.md](README.md)

> Status: v0.1, masih awal. Pipeline dan tool sudah jalan; galeri demo belum ada.

## Yang dihasilkan

| Pipeline | Anda bilang | Anda dapat |
|---|---|---|
| `client-site` | "Buatkan website untuk klien saya, klinik gigi di Bandung" | Situs berdesain khusus, tayang di alamatnya sendiri, bisa diedit klien |
| `site-migration` | "Pindahkan website klien saya di contoh.com ke desain baru" | Isi situs lama dalam desain baru, beserta peta alamat lama |
| `template-for-sale` | "Buat template untuk kantor notaris" | Bundle template terunggah sebagai draft, listing marketplace siap |
| `landing-3d` | "Landing page dengan botol yang berputar saat digulir" | Satu halaman dengan satu momen 3D, dan gambar pengganti bagi pengunjung lain |

## Mulai cepat

Butuh Node 20 atau lebih baru, sebuah agen coding, dan akun
[webto.id](https://app.webto.id) gratis.

```bash
git clone https://github.com/webto-id/webto-studio
cd webto-studio
npm install
```

Buat token akses di dashboard (Pengaturan, Keamanan, Token akses) lalu simpan
sebagai variabel lingkungan. Jangan tempel token ke percakapan dengan agen.

```bash
export WEBTO_TOKEN="wbt_..."       # macOS, Linux
setx WEBTO_TOKEN "wbt_..."         # Windows, lalu buka terminal baru
```

Buka folder ini di agen Anda dan minta:

```
Buatkan website untuk klien saya, Warung Senja, rumah makan kecil di Yogyakarta.
```

Contoh permintaan lain: [PROMPT_GALLERY.md](PROMPT_GALLERY.md).

Supaya agen bisa memotret hasil kerjanya sendiri (disarankan):

```bash
npm run setup:browser
```

## Cara kerjanya

Agen Anda yang mengatur pekerjaan. Repo ini memberinya aturan main.

```
AGENT_GUIDE.md        aturan: satu pipeline per permintaan, gerbang persetujuan, tanpa fakta karangan
pipeline_defs/        empat pipeline: tahap, artefak, syarat selesai
skills/pipelines/     cara menjalankan tiap tahap
skills/meta/          onboarding, review mandiri, gerbang persetujuan, arah desain
skills/core/          keahlian: format section, bundle situs dan template, resep 3D
schemas/              bentuk setiap artefak yang ditulis sebuah tahap
tools/                preflight, check, checkpoint, tangkapan layar, pembaca situs lama
projects/             pekerjaan Anda, satu folder per situs (tidak dilacak git)
```

Tiga hal yang menjaga agen tetap jujur:

- **Gerbang persetujuan.** Rencana, penulisan pertama ke akun Anda,
  penerbitan, dan harga masing-masing berhenti menunggu jawaban Anda. Tool
  checkpoint menolak tahap bergerbang yang belum mencatat persetujuan.
- **Pemeriksaan yang dijalankan, bukan diklaim.** Bundle dikompilasi dengan
  validator milik platform, dan hasilnya terikat pada berkas di disk: ubah
  satu berkas, tahap itu harus diperiksa ulang.
- **Melihat hasilnya.** Agen memotret halaman sungguhan pada lebar ponsel,
  tablet, dan desktop, mengukur gulir menyamping dan gambar yang gagal
  dimuat, lalu menilai tangkapan layarnya sebelum melapor.

## Yang tidak dilakukan

- Tidak mengarang fakta usaha. Harga, alamat, jam buka, dan testimoni datang
  dari Anda, dokumen klien, atau situs lama klien.
- Tidak menerbitkan, menetapkan harga, atau menghapus halaman tanpa diminta.
- Tidak bisa memasang domain kustom, mengatur pembayaran, atau mengedit
  produk dan artikel blog; semua itu lewat dashboard, dan catatan serah
  terima menyebutkan tempatnya.
- Memindahkan situs jadi ke akun lain belum tersedia. Untuk sementara, klien
  yang harus memiliki situsnya membuat token dari akunnya sendiri.
- Belum ada pembuatan gambar AI di v0.1. Situs memakai gambar Anda sendiri
  atau foto stok pengganti.

## Biaya

Framework ini gratis dan berlisensi MIT. Pemakaian agen ditagih oleh penyedia
agen Anda. Akun webto.id bisa gratis; batas dan paket berbayarnya tampil di
dashboard dan dibaca agen sebelum menyusun rencana.

## Agen yang didukung

Agen apa pun yang membaca berkas instruksi proyek dan bisa terhubung ke
server MCP lewat HTTP. Berkas penunjuk tersedia untuk Claude Code
(`CLAUDE.md`), Codex dan lainnya (`AGENTS.md`), Cursor (`.cursor/rules/`),
GitHub Copilot (`.github/copilot-instructions.md`), dan Windsurf
(`.windsurfrules`). Server MCP diatur di `.mcp.json`; bila agen Anda menyimpan
pengaturan MCP di tempat lain, salin entrinya ke sana.

## Lisensi

MIT
