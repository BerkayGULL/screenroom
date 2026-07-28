# ScreenRoom Teknik Proje Raporu

## 1. Projenin amacı

ScreenRoom, küçük bir arkadaş grubunun davet bağlantısıyla özel odaya girip bir kişinin ekranını gerçek zamanlı izlemesi için geliştirildi. Hedef, karmaşık bir yayın platformu kurmadan sade bir watch-party arayüzü sağlamaktır.

## 2. Kapsam ve alınan kararlar

İlk sürümde hesap, veritabanı, kayıt alma ve medya dosyası barındırma yoktur. Bu kararlar, projeyi ücretsiz çalıştırılabilir, kolay anlaşılır ve küçük grup kullanımına uygun tutar.

- **Hedef ölçek:** Bir yayıncı ve en fazla dört izleyici.
- **Aktarım biçimi:** WebRTC ile P2P. Yayın verisi sunucudan geçmez; yayıncıdan izleyiciye gider.
- **Kalite:** Kullanıcı 720p/1080p, 30/60 FPS ve kalite hedefini seçer.
- **Gizlilik:** Odaya yalnızca bağlantıyı bilen kişiler katılabilir. Bu MVP'de parola yoktur; üretim sürümünde eklenmelidir.

## 3. Mimari

```text
Tarayıcı (yayıncı) ── WebRTC medya akışı ──> Tarayıcı (izleyici)
        │                                           ▲
        └──── Socket.IO sinyalleşme sunucusu ────────┘
                         │
                    Express / Node.js
```

**Express**, tek sayfalık istemci dosyalarını sunar. **Socket.IO**, kullanıcının odaya girmesi, katılımcı listesinin güncellenmesi ve WebRTC teklif/cevap/ICE mesajlarının doğru kişiye iletilmesinden sorumludur. **WebRTC**, medya verisini doğrudan tarayıcılar arasında taşır. Bu ayrım, sunucu bant genişliği maliyetini düşürür.

## 4. Dosya yapısı

```text
server.js           Socket.IO odaları ve sinyalleşme
public/index.html   Ekranların ve ayar penceresinin yapısı
public/styles.css   Responsive arayüz tasarımı
public/app.js       Oda deneyimi, WebRTC ve istatistikler
package.json        Çalışma komutları ve bağımlılıklar
README.md           GitHub ana sayfa dokümantasyonu
```

## 5. Kullanılan API'ler ve gerekçeleri

| Araç / API | Kullanım amacı | Seçilme nedeni |
| --- | --- | --- |
| `getDisplayMedia` | Ekran veya pencere seçimi | Tarayıcının yerleşik ve izin tabanlı ekran paylaşım API'si. |
| `RTCPeerConnection` | Ses/video aktarımı | Düşük gecikmeli P2P iletişim için web standardı. |
| `getStats` | Çözünürlük, FPS, bitrate | Kullanıcının gerçek yayın kalitesini görmesini sağlar. |
| Socket.IO | Sinyalleşme ve odalar | WebSocket bağlantısını kolaylaştırır; yeniden bağlanma davranışı sunar. |
| STUN | Ağdaki aday bağlantıları bulma | Küçük prototip için ücretsiz başlangıç çözümü. |

## 6. Kalite hesaplama yaklaşımı

Seçilen kaliteye göre izleyici başına bir bitrate aralığı belirlenir. Düşük/dengeli/yüksek seçimi bu aralığın başı/ortası/sonu alınarak hesaplanır. P2P'de yayıncı her izleyiciye ayrı akış gönderdiği için toplam upload, izleyici sayısıyla çarpılır. Ani ağ değişimleri için yüzde 20 güvenlik payı eklenir.

Bu sadece ön tahmindir. Ekrandaki hareket miktarı, ekranın çözünürlüğü, tarayıcı kodlayıcısı ve internet koşulları sonucu değiştirir. Uygulama bu nedenle ayrıca canlı istatistik alanı gösterir.

## 7. Güvenlik ve bilinen sınırlamalar

- Ekran paylaşımı kullanıcı etkileşimi ve tarayıcı izni olmadan başlatılamaz.
- Ekran paylaşımı üretimde HTTPS gerektirir.
- Oda verisi şu an bellekte tutulur; sunucu yeniden başlarsa odalar silinir.
- Google STUN sunucuları yalnız başına her ağda bağlantı garantisi vermez. Üretimde TURN (örneğin coturn) eklenmelidir.
- DRM korumalı video servisleri, sistem veya tarayıcı tarafından siyah ekrana düşürülebilir. Bu bir uygulama hatası değildir.
- Davet bağlantısı ele geçirilirse odaya girilebilir. Parola, bekleme odası ve yayıncı onayı sonraki sürüm için önerilir.

## 8. Sonraki geliştirmeler

1. Oda parolası, bekleme odası ve katılımcı çıkarma.
2. Metin sohbeti ve emoji tepkileri.
3. Kalıcı odalar/ayarlar için PostgreSQL veya SQLite.
4. TURN sunucusu ve ortam değişkeniyle yapılandırma.
5. Daha büyük gruplar için SFU (LiveKit veya mediasoup) mimarisi.
6. Bağlantı sorunları için ayrıntılı hata ekranı ve otomatik kalite düşürme.

## 9. GitHub'a yükleme

```bash
git add .
git commit -m "feat: create ScreenRoom WebRTC sharing MVP"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/screenroom.git
git push -u origin main
```

GitHub'a kesinlikle `.env`, API anahtarı veya TURN parolası eklenmemelidir. Bu proje için `.gitignore` dosyası hazırdır.
