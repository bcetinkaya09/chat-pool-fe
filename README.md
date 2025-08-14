# ChatPool

## Proje Hakkında
ChatPool, gerçek zamanlı sohbet imkanı sunan, React ve Socket.io tabanlı bir web uygulamasıdır. Kullanıcılar isimleriyle giriş yaparak aktif kullanıcılar listesinde yer alır ve anlık olarak mesajlaşabilirler. Uygulama modern bir arayüze ve kullanıcı dostu bir deneyime sahiptir.

## Özellikler
- Gerçek zamanlı sohbet
- Aktif kullanıcılar listesi
- Kullanıcı adı ile giriş
- Modern ve responsive arayüz (TailwindCSS)
- Sistem mesajları ve kullanıcı ayrımı

## Kurulum

### Gereksinimler
- Node.js (v18+ önerilir)
- npm veya yarn

### Adımlar
1. Depoyu klonlayın:
   ```bash
   git clone <repo-url>
   cd chat-pool-fe
   ```
2. Bağımlılıkları yükleyin:
   ```bash
   yarn install
   # veya
   npm install
   ```
3. Ortam değişkenlerini ayarlayın:
   - `.env` dosyası oluşturun ve aşağıdaki gibi Socket sunucu adresini ekleyin:
     ```env
     VITE_SOCKET_URL=<SOCKET_SERVER_URL>
     ```
4. Geliştirme sunucusunu başlatın:
   ```bash
   yarn dev
   # veya
   npm run dev
   ```
5. Uygulamayı tarayıcıda açın: [http://localhost:5173](http://localhost:5173)

## Kullanım
- İsim girerek giriş yapın.
- Aktif kullanıcılar listesini ve sohbet geçmişini görüntüleyin.
- Mesajınızı yazıp gönderin.

## Yapılandırma ve Teknolojiler
- **React 19**
- **Vite** ile hızlı geliştirme
- **TypeScript**
- **TailwindCSS** ile modern tasarım
- **Socket.io-client** ile gerçek zamanlı iletişim

## Katkıda Bulunanlar
- **Yazar:** Büşra Çetinkaya

## Lisans
Bu proje MIT lisansı ile lisanslanmıştır.