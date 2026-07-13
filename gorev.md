# Unity AI Givelopment Studio - Geliştirme Yol Haritası (Görevler)

Bu dosya, sistemi daha derin, kaliteli ve profesyonel hale getirmek için planlanan 18 adet ileri düzey görevi içermektedir.

---

### 📂 A. Motor Entegrasyonu ve 3D Araçlar (Engine Integration & 3D Tools)

#### 1. ProBuilder Parametrik Geometri Oluşturucu Aracı
* **Açıklama**: Sahneye gelişmiş 3D modelleme yapabilmek için ProBuilder entegrasyonu sağlayan bir tool eklenmelidir.
* **Detay**: AI, `create_probuilder_shape` aracı ile sahneye dinamik duvar, merdiven, kiriş veya parametrik silindirler yerleştirebilmelidir.

#### 2. Dinamik Materyal, Renk ve Shader Atama Sistemi
* **Açıklama**: Sahneye eklenen primitive nesnelerin renklendirilmesi ve kaplanması için araçlar geliştirilmelidir.
* **Detay**: `apply_material` ve `set_material_properties` araçları ile nesnelerin Metallic, Smoothness, Albedo özellikleri ve renk kodları (RGB/Hex) değiştirilebilmelidir.

#### 3. İleri Düzey Fizik ve Collider Yönetimi
* **Açıklama**: Nesnelerin fiziksel davranışlarını AI kontrolüne açacak bir fizik aracı yazılmalıdır.
* **Detay**: Nesnelere RigidBody ekleme, kütle (mass) ayarları, yerçekimi etkileşimi ve Box/Sphere/Mesh Collider'ları otomatik optimize eden `set_physics_properties` aracı geliştirilmelidir.

#### 4. Cinemachine Sanal Kamera Kontrol Aracı
* **Açıklama**: Kamera açılarının ve sinematik geçişlerin AI tarafından programlanabilmesi sağlanmalıdır.
* **Detay**: Cinemachine sanal kameralarını dinamik oluşturan, belirli bir hedefe (Target) kilitleyen ve takip (LookAt/Follow) mesafelerini ayarlayan `configure_cinemachine` aracı eklenmelidir.

#### 5. Prefab Örneklendirme (Instantiate) Geliştirmesi
* **Açıklama**: Sadece boş nesneler değil, projede önceden tasarlanmış hazır Prefab'ların sahneye çağrılması sağlanmalıdır.
* **Detay**: Projedeki prefab varlıklarını ada göre bulup sahneye doğru koordinat, rotasyon ve parent ayarlarıyla yerleştiren `instantiate_prefab` aracı yazılmalıdır.

---

### 💻 B. Arayüz ve UI/UX İyileştirmeleri (UI/UX & Client Enhancements)

#### 6. WebSocket Tabanlı Gerçek Zamanlı Konsol Akışı
* **Açıklama**: Unity konsol loglarının HTTP polling olmadan anında Electron arayüzüne düşmesi sağlanmalıdır.
* **Detay**: Editör log akışı için arka planda WebSocket bağlantısı kurulmalı ve Unity'de oluşan her log (Warning/Error/Info) sıfır gecikmeyle sohbet ekranının yanındaki konsolda akmalıdır.

#### 7. Görsel Geri Al / İleri Al (Undo / Redo) Butonları
* **Açıklama**: Yapay zekanın yaptığı son sahne değişikliklerini geri almak için arayüze butonlar eklenmelidir.
* **Detay**: Sohbet penceresinin üstüne eklenecek butonlar, Unity Editöründeki `Undo.PerformUndo()` ve `Undo.PerformRedo()` komutlarını köprü üzerinden tetiklemelidir.

#### 8. Sohbeti Dışa Aktarma (Session Export) Desteği
* **Açıklama**: Yapılan planlama ve kodlama seanslarının daha sonra kullanılabilmesi için dışa aktarılması sağlanmalıdır.
* **Detay**: Arayüze "Sohbeti Kaydet" butonu eklenerek aktif konuşma geçmişi Markdown (`.md`) veya JSON formatında bilgisayara indirilebilmelidir.

#### 9. Canlı 3D Arayüz Viewport Çerçevesi
* **Açıklama**: Arayüzdeki statik ekran görüntüsü (screenshot) yerine canlı veya yarı-canlı bir görüntü akışı sağlanmalıdır.
* **Detay**: Unity kamerasından gelen görüntüyü saniyede 10-15 kare (FPS) hızla Electron arayüzündeki Kamera sekmesine aktaran optimize bir akış mekanizması kurulmalıdır.

#### 10. Gelişmiş Hiyerarşi Arama ve Bileşen Filtreleme
* **Açıklama**: Çok büyük sahnelerde nesneleri aramayı kolaylaştıran filtreler eklenmelidir.
* **Detay**: Arayüzdeki Hierarchy sekmesinde sadece ada göre değil, bileşen tipine (örn: sadece `Light` içeren nesneler) veya aktiflik durumuna göre filtreleme yapılabilmelidir.

---

### ⚙️ C. Gelişmiş MCP ve Köprü Araçları (MCP Bridge & Server Enhancements)

#### 11. Çoklu Unity Projesi Algılama ve Seçim Desteği
* **Açıklama**: Sunucunun aynı anda açık olan birden fazla Unity projesini desteklemesi sağlanmalıdır.
* **Detay**: Sunucu aktif projenin port numarasını otomatik algılamalı ve kullanıcıya arayüz üzerinden hangi Unity projesine bağlanmak istediğini seçtirmelidir.

#### 12. C# Editör Kod Yürütücüsü (execute_editor_code)
* **Açıklama**: AI'ın Unity editörünü manipüle etmek için geçici script yazıp derleme beklemesi yerine doğrudan kod yürütmesi sağlanmalıdır.
* **Detay**: Arayüzden gönderilen tek satırlık veya blok halindeki C# editör kodlarını dinamik olarak derleyip (`C# Reflection / Roslyn`) Unity üzerinde anında çalıştıran bir araç geliştirilmelidir.

#### 13. Derleme Hataları İzleyicisi ve Otomatik Düzeltici (Auto-Fixer)
* **Açıklama**: Unity derleme hatası verdiğinde AI'ın bunu algılayıp kendi yazdığı kodu düzeltmesi sağlanmalıdır.
* **Detay**: Derleme hatası algılandığında konsol loglarındaki satır numarası ve hata kodu AI'a otomatik olarak bir prompt olarak gönderilmeli ve AI'ın hatayı otomatik tamir etmesi istenmelidir.

#### 14. Sahne Sorgulama Derinlik Sınırlaması (Max Depth Parameter)
* **Açıklama**: Çok büyük sahnelerde sahne ağacı verisinin boyutunu düşürmek için sınırlama getirilmelidir.
* **Detay**: `get_scene_hierarchy` aracına `max_depth` (Maksimum Derinlik) parametresi eklenerek çok alt dallara sahip sahnelerde sadece ana dalların çekilmesi ve performansın korunması sağlanmalıdır.

---

### 🔒 D. Optimizasyon ve Güvenlik (Optimization & Security)

#### 15. Otomatik DLL/Assembly Derleme ve Güncelleme
* **Açıklama**: Sunucu tarafında yapılan C# güncellemelerinin Unity'yi kilitlemeden derlenmesi sağlanmalıdır.
* **Detay**: MCP Bridge araç sınıfları bağımsız bir Assembly Definition (`.asmdef`) içine alınmalı veya DLL olarak derlenerek Unity projesine aktarılmalıdır. Böylece tüm projenin gereksiz yere yeniden derlenmesi önlenir.

#### 16. Token Sıkıştırma Algoritması (Context Compression)
* **Açıklama**: Kayan sohbet penceresinde silinen eski mesajların içindeki önemli bilgilerin kaybolmaması sağlanmalıdır.
* **Detay**: Silinmek üzere olan eski mesajlardaki kod blokları ve kararlar, arka planda küçük bir özet (summary) haline getirilerek sistem promptuna eklenmeli, böylece AI'ın hafızası taze tutulmalıdır.

#### 17. Kayıtlı Sohbetler için Yerel Şifreleme (AES Encryption)
* **Açıklama**: `localStorage` üzerinde düz metin olarak tutulan sohbet geçmişi ve API anahtarları güvenli hale getirilmelidir.
* **Detay**: Kullanıcının API anahtarları ve proje detayları yerel depolamaya yazılmadan önce hafif bir şifreleme algoritması (örn. AES-CBC) ile şifrelenmelidir.

#### 18. Gelişmiş Dizin ve Dosya Yolu Doğrulama (Sanitization)
* **Açıklama**: AI'ın sistem dosyalarına veya proje dışındaki dizinlere erişmesi engellenmelidir.
* **Detay**: `download_asset`, `read_script` veya `write_script` gibi araçlarda girilen dosya yolları, çalıştırılmadan önce regex doğrulamasına tabi tutulmalı ve kesinlikle proje sınırları dışına (`Assets/` dışı veya üst klasörler) çıkılmasına izin verilmemelidir.
