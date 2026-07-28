# ScreenRoom

Küçük arkadaş grupları için WebRTC tabanlı, özel odalarda ekran paylaşımı yapabilen sade bir web uygulaması.

> Bu proje video barındırmaz veya film içeriği sağlamaz. Yayıncı, kendi tarayıcısından izin vererek ekranını ya da bir uygulama penceresini paylaşır.

## Özellikler

- Rastgele kodlu oda ve paylaşılabilir davet bağlantısı
- Hesapsız katılım ve katılımcı listesi
- Ekran veya pencere paylaşımı
- 720p/1080p, 30/60 FPS ve düşük/dengeli/yüksek kalite hedefleri
- Seçilen kalite ve izleyici sayısına göre upload tahmini
- Canlı çözünürlük, FPS ve bitrate göstergesi
- Yayıncı ayrıldığında oda sahipliğinin otomatik devri
- Küçük gruplar için doğrudan tarayıcıdan tarayıcıya (P2P) yayın

## Teknolojiler

- **Node.js + Express:** Statik istemciyi sunar.
- **Socket.IO:** Oda, katılımcı durumu ve WebRTC sinyalleşmesini yönetir.
- **WebRTC:** Ekran görüntüsünü yayıncıdan izleyicilere aktarır.
- **Vanilla HTML/CSS/JavaScript:** Derleme adımı olmadan hızlı ve sade arayüz.

## Yerelde çalıştırma

Ön koşul: [Node.js 20+](https://nodejs.org/) kurulu olmalı.

```bash
npm install
npm start
```

Tarayıcıdan `http://localhost:3000` adresini açın. Aynı bilgisayarda iki farklı tarayıcı profiliyle veya aynı ağdaki başka bir cihazla test edebilirsiniz.

Geliştirme modunda:

```bash
npm run dev
```

## Kullanım

1. Ana sayfada adını yazıp **Yeni oda oluştur** seçeneğine basın.
2. Sağ üstteki **Kopyala** düğmesiyle oda bağlantısını arkadaşlarınıza gönderin.
3. **Yayın ayarları**ndan hedef çözünürlük, FPS, kalite ve izleyici sayısını seçin.
4. **Ekranını paylaş** seçeneğiyle tarayıcının paylaşım iznini verin.
5. İşiniz bitince **Yayını bitir** düğmesine basın.

## Bağlantı ve kalite hesabı

Uygulama, küçük grup için P2P mesh yaklaşımı kullanır. Bu nedenle yayıncı aynı video akışını her izleyiciye ayrı yollar.

`yaklaşık upload = izleyici başı bitrate × izleyici sayısı × 1.2`

| Hedef | İzleyici başı önerilen bitrate |
| --- | --- |
| 720p / 30 FPS | 2.5–4 Mbps |
| 720p / 60 FPS | 4–6 Mbps |
| 1080p / 30 FPS | 5–8 Mbps |
| 1080p / 60 FPS | 8–12 Mbps |

Örneğin 1080p60, dengeli kalite ve 3 izleyici için yaklaşık `10 × 3 × 1.2 = 36 Mbps` upload gerekir. Tarayıcı ve ağ koşulları nedeniyle bunlar garanti değil, hedef değerlerdir.

## Kısıtlar

- P2P yaklaşımı **1 yayıncı + en fazla 4 izleyici** için tasarlanmıştır.
- Bazı ağlarda NAT/firewall sebebiyle yalnızca STUN yeterli olmayabilir. Gerçek dağıtımda TURN sunucusu eklenmelidir.
- Netflix, Disney+ gibi DRM korumalı kaynakların paylaşımı siyah ekran verebilir; bu uygulama bunu aşmaz.
- 1080p60, yayıncının ekranı, tarayıcısı ve upload hızına bağlıdır; zorla garanti edilemez.

## Dağıtım

Uygulama için HTTPS zorunludur; `getDisplayMedia` güvenli bağlamda çalışır. Node uygulamasını Render, Railway, Fly.io veya bir VPS üzerinde çalıştırabilirsiniz. Kalıcı küçük sunucu için Oracle Cloud Always Free + Node.js süreç yöneticisi iyi bir seçenek olabilir. CORS/HTTPS ters vekil ayarlarını, özel alan adınızı ve TURN sunucunuzu üretim aşamasında yapılandırın.

Detaylı geliştirme raporu için [RAPOR.md](RAPOR.md) dosyasına bakın.
