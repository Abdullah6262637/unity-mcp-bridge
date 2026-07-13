# Unity AI Givelopment Studio - Geliştirme Yol Haritası (Görevler ve Doğrulama Kriterleri)

Bu dosya, sistemi daha derin, kaliteli ve profesyonel hale getirmek için planlanan 18 adet ileri düzey görevi ve bu görevlerin tamamlandığını onaylamak için yapılacak **kontrol ve doğrulama kriterlerini** içermektedir.

---

### 📂 A. Motor Entegrasyonu ve 3D Araçlar (Engine Integration & 3D Tools)

#### 1. ProBuilder Parametrik Geometri Oluşturucu Aracı
* **Açıklama**: Sahneye gelişmiş 3D modelleme yapabilmek için ProBuilder entegrasyonu sağlayan bir tool eklenmelidir.
* **Detay**: AI, `create_probuilder_shape` aracı ile sahneye dinamik duvar, merdiven, kiriş veya parametrik silindirler yerleştirebilmelidir.
* **Doğrulama Kriteri**: AI'a *"Sahneye 10 basamaklı bir ProBuilder merdiven yerleştir"* talimatı verilir. Sahnede ProBuilder Mesh bileşenine sahip bir merdiven oluştuğu, basamak sayısının 10 olduğu ve Unity Editöründe seçilip düzenlenebildiği onaylanır.

#### 2. Dinamik Materyal, Renk ve Shader Atama Sistemi
* **Açıklama**: Sahneye eklenen primitive nesnelerin renklendirilmesi ve kaplanması için araçlar geliştirilmelidir.
* **Detay**: `apply_material` ve `set_material_properties` araçları ile nesnelerin Metallic, Smoothness, Albedo özellikleri ve renk kodları (RGB/Hex) değiştirilebilmelidir.
* **Doğrulama Kriteri**: AI'a *"Küp1 nesnesini kırmızı yap ve metalik değerini 0.8 yap"* talimatı verilir. Nesnenin Renderer üzerindeki materyal renginin `(1, 0, 0)` olduğu ve Metallic kaydırıcısının `0.8` değerine ulaştığı inspektörden kontrol edilir.

#### 3. İleri Düzey Fizik ve Collider Yönetimi
* **Açıklama**: Nesnelerin fiziksel davranışlarını AI kontrolüne açacak bir fizik aracı yazılmalıdır.
* **Detay**: Nesnelere RigidBody ekleme, kütle (mass) ayarları, yerçekimi etkileşimi ve Box/Sphere/Mesh Collider'ları otomatik optimize eden `set_physics_properties` aracı geliştirilmelidir.
* **Doğrulama Kriteri**: AI'a *"Küp1 nesnesine fizik ekle, kütlesini 5 yap ve yerçekimini aç"* talimatı verilir. Küp1'e `Rigidbody` bileşeni eklendiği, `Mass` değerinin `5` olduğu ve `Use Gravity` seçeneğinin işaretlendiği doğrulanır. Play modda küpün yere düştüğü gözlemlenir.

#### 4. Cinemachine Sanal Kamera Kontrol Aracı
* **Açıklama**: Kamera açılarının ve sinematik geçişlerin AI tarafından programlanabilmesi sağlanmalıdır.
* **Detay**: Cinemachine sanal kameralarını dinamik oluşturan, belirli bir hedefe (Target) kilitleyen ve takip (LookAt/Follow) mesafelerini ayarlayan `configure_cinemachine` aracı eklenmelidir.
* **Doğrulama Kriteri**: AI'a *"Oyundaki arabayı 5 metre geriden takip eden bir Cinemachine kamerası kur"* talimatı verilir. Sahnede `CinemachineVirtualCamera` oluştuğu, `Follow` ve `LookAt` alanlarına araba nesnesinin atandığı ve takip mesafesinin 5 metre olarak ayarlandığı test edilir.

#### 5. Prefab Örneklendirme (Instantiate) Geliştirmesi
* **Açıklama**: Sadece boş nesneler değil, projede önceden tasarlanmış hazır Prefab'ların sahneye çağrılması sağlanmalıdır.
* **Detay**: Projedeki prefab varlıklarını ada göre bulup sahneye doğru koordinat, rotasyon ve parent ayarlarıyla yerleştiren `instantiate_prefab` aracı yazılmalıdır.
* **Doğrulama Kriteri**: AI'a *"Assets/Prefabs içindeki Car prefabını [0,0,0] konumuna koy"* talimatı verilir. Sahnede prefab bağlantısı (blue icon) kopmamış şekilde yeni bir araba nesnesi klonlandığı hiyerarşide doğrulanır.

---

### 💻 B. Arayüz ve UI/UX İyileştirmeleri (UI/UX & Client Enhancements)

#### 6. WebSocket Tabanlı Gerçek Zamanlı Konsol Akışı
* **Açıklama**: Unity konsol loglarının HTTP polling olmadan anında Electron arayüzüne düşmesi sağlanmalıdır.
* **Detay**: Editör log akışı için arka planda WebSocket bağlantısı kurulmalı ve Unity'de oluşan her log (Warning/Error/Info) sıfır gecikmeyle sohbet ekranının yanındaki konsolda akmalıdır.
* **Doğrulama Kriteri**: Unity'de bir script içerisinden `Debug.Log("Test log mesajı")` tetiklenir. Arayüzde hiçbir sayfayı yenilemeden veya bekletmeden, konsol panelinde bu yazının anlık olarak belirdiği gözlemlenir.

#### 7. Görsel Geri Al / İleri Al (Undo / Redo) Butonları
* **Açıklama**: Yapay zekanın yaptığı son sahne değişikliklerini geri almak için arayüze butonlar eklenmelidir.
* **Detay**: Sohbet penceresinin üstüne eklenecek butonlar, Unity Editöründeki `Undo.PerformUndo()` ve `Undo.PerformRedo()` komutlarını köprü üzerinden tetiklemelidir.
* **Doğrulama Kriteri**: AI bir küp oluşturduktan sonra arayüzdeki "Geri Al" (Undo) butonuna basılır. Küpün sahneden silindiği görülür. Ardından "İleri Al" (Redo) butonuna basıldığında küpün sahneye aynı koordinatlarla geri geldiği gözlemlenir.

#### 8. Sohbeti Dışa Aktarma (Session Export) Desteği
* **Açıklama**: Yapılan planlama ve kodlama seanslarının daha sonra kullanılabilmesi için dışa aktarılması sağlanmalıdır.
* **Detay**: Arayüze "Sohbeti Kaydet" butonu eklenerek aktif konuşma geçmişi Markdown (`.md`) veya JSON formatında bilgisayara indirilebilmelidir.
* **Doğrulama Kriteri**: Birkaç mesajlık sohbetten sonra "Sohbeti Kaydet" butonuna tıklanır. Bilgisayara inen `.md` dosyası açıldığında, konuşulan tüm kullanıcı ve asistan mesajlarının tarih, saat ve formatlı kod bloklarıyla birlikte eksiksiz yazıldığı doğrulanır.

#### 9. Canlı 3D Arayüz Viewport Çerçevesi
* **Açıklama**: Arayüzdeki statik ekran görüntüsü (screenshot) yerine canlı veya yarı-canlı bir görüntü akışı sağlanmalıdır.
* **Detay**: Unity kamerasından gelen görüntüyü saniyede 10-15 kare (FPS) hızla Electron arayüzündeki Kamera sekmesine aktaran optimize bir akış mekanizması kurulmalıdır.
* **Doğrulama Kriteri**: Unity'de Play moda geçilir ve sahnedeki bir nesne hareket ettirilir. Electron arayüzündeki Kamera panelinde nesnenin hareketi canlı veya akıcı bir slayt gösterisi (en az 10 FPS) olarak izlenebilir olmalıdır.

#### 10. Gelişmiş Hiyerarşi Arama ve Bileşen Filtreleme
* **Açıklama**: Çok büyük sahnelerde nesneleri aramayı kolaylaştıran filtreler eklenmelidir.
* **Detay**: Arayüzdeki Hierarchy sekmesinde sadece ada göre değil, bileşen tipine (örn: sadece `Light` içeren nesneler) veya aktiflik durumuna göre filtreleme yapılabilmelidir.
* **Doğrulama Kriteri**: Hiyerarşi arama kutusuna `t:Light` yazılır. Listede sadece directional, point ve spot light nesnelerinin kaldığı, kameraların ve diğer meshlerin gizlendiği test edilir.

---

### ⚙️ C. Gelişmiş MCP ve Köprü Araçları (MCP Bridge & Server Enhancements)

#### 11. Çoklu Unity Projesi Algılama ve Seçim Desteği
* **Açıklama**: Sunucunun aynı anda açık olan birden fazla Unity projesini desteklemesi sağlanmalıdır.
* **Detay**: Sunucu aktif projenin port numarasını otomatik algılamalı ve kullanıcıya arayüz üzerinden hangi Unity projesine bağlanmak istediğini seçtirmelidir.
* **Doğrulama Kriteri**: Bilgisayarda iki farklı Unity projesi açılır (Biri Port 5000, diğeri Port 5001'de çalışmaktadır). Electron ayarlar panelinde iki projenin de listelendiği ve seçim değiştirildiğinde hiyerarşinin ilgili projeye göre güncellendiği onaylanır.

#### 12. C# Editör Kod Yürütücüsü (execute_editor_code)
* **Açıklama**: AI'ın Unity editörünü manipüle etmek için geçici script yazıp derleme beklemesi yerine doğrudan kod yürütmesi sağlanmalıdır.
* **Detay**: Arayüzden gönderilen tek satırlık veya blok halindeki C# editör kodlarını dinamik olarak derleyip (`C# Reflection / Roslyn`) Unity üzerinde anında çalıştıran bir araç geliştirilmelidir.
* **Doğrulama Kriteri**: AI'a `Selection.activeGameObject = GameObject.Find("Küp1");` kodu gönderilir. Kod çalıştırıldığı anda Unity Editöründe "Küp1" isimli nesnenin otomatik olarak seçili hale geldiği (mavi çerçeve içine alındığı) gözlemlenir.

#### 13. Derleme Hataları İzleyicisi ve Otomatik Düzeltici (Auto-Fixer)
* **Açıklama**: Unity derleme hatası verdiğinde AI'ın bunu algılayıp kendi yazdığı kodu düzeltmesi sağlanmalıdır.
* **Detay**: Derleme hatası algılandığında konsol loglarındaki satır numarası ve hata kodu AI'a otomatik olarak bir prompt olarak gönderilmeli ve AI'ın hatayı otomatik tamir etmesi istenmelidir.
* **Doğrulama Kriteri**: Bilerek yazım hatası içeren bir C# scripti sahneye eklenir. Unity'de derleme durur. Arayüzün bunu hemen algılayıp sohbet ekranında *"Derleme Hatası Bulundu! Hata: CS1002 (semicolon missing) Satır: 15. Düzeltmemi ister misiniz?"* uyarısı verdiği ve onaylandığında hatayı giderip projeyi başarıyla derlediği doğrulanır.

#### 14. Sahne Sorgulama Derinlik Sınırlaması (Max Depth Parameter)
* **Açıklama**: Çok büyük sahnelerde sahne ağacı verisinin boyutunu düşürmek için sınırlama getirilmelidir.
* **Detay**: `get_scene_hierarchy` aracına `max_depth` (Maksimum Derinlik) parametresi eklenerek çok alt dallara sahip sahnelerde sadece ana dalların çekilmesi ve performansın korunması sağlanmalıdır.
* **Doğrulama Kriteri**: İç içe 10 alt nesne barındıran bir hiyerarşide `get_scene_hierarchy` aracı `max_depth: 2` ile çağrılır. Çıktıda sadece 1. ve 2. seviye alt nesnelerin listelendiği, daha derin nesnelerin veri boyutunu şişirmemek için kırpıldığı JSON çıktısından doğrulanır.

---

### 🔒 D. Optimizasyon ve Güvenlik (Optimization & Security)

#### 15. Otomatik DLL/Assembly Derleme ve Güncelleme
* **Açıklama**: Sunucu tarafında yapılan C# güncellemelerinin Unity'yi kilitlemeden derlenmesi sağlanmalıdır.
* **Detay**: MCP Bridge araç sınıfları bağımsız bir Assembly Definition (`.asmdef`) içine alınmalı veya DLL olarak derlenerek Unity projesine aktarılmalıdır. Böylece tüm projenin gereksiz yere yeniden derlenmesi önlenir.
* **Doğrulama Kriteri**: Editör araçlarında bir değişiklik yapıldığında Unity'nin sağ alt köşesinde dönen yükleme tekerleğinin (compilation) tüm projeyi derlemediği, sadece ilgili araç modülünü derleyerek yükleme süresini 1 saniyenin altına indirdiği test edilir.

#### 16. Token Sıkıştırma Algoritması (Context Compression)
* **Açıklama**: Kayan sohbet penceresinde silinen eski mesajların içindeki önemli bilgilerin kaybolmaması sağlanmalıdır.
* **Detay**: Silinmek üzere olan eski mesajlardaki kod blokları ve kararlar, arka planda küçük bir özet (summary) haline getirilerek sistem promptuna eklenmeli, böylece AI'ın hafızası taze tutulmalıdır.
* **Doğrulama Kriteri**: 20 turn süren uzun bir konuşmadan sonra `localStorage` üzerindeki aktif geçmiş kontrol edilir. İlk mesajların silindiği ancak sistem promptunun başına *"Önceki adımlarda Küp1 ve Küre2 oluşturuldu, fizik ayarları yapıldı"* şeklinde otomatik özet eklendiği gözlemlenir.

#### 17. Kayıtlı Sohbetler için Yerel Şifreleme (AES Encryption)
* **Açıklama**: `localStorage` üzerinde düz metin olarak tutulan sohbet geçmişi ve API anahtarları güvenli hale getirilmelidir.
* **Detay**: Kullanıcının API anahtarları ve proje detayları yerel depolamaya yazılmadan önce hafif bir şifreleme algoritması (örn. AES-CBC) ile şifrelenmelidir.
* **Doğrulama Kriteri**: Tarayıcıda F12 tuşuna basılıp DevTools -> Application -> Local Storage açılır. Kayıtlı verilerin düz metin (plain text) yerine `U2FsdGVkX19...` gibi okunamaz şifreli hash dizileri olarak tutulduğu doğrulanır.

#### 18. Gelişmiş Dizin ve Dosya Yolu Doğrulama (Sanitization)
* **Açıklama**: AI'ın sistem dosyalarına veya proje dışındaki dizinlere erişmesi engellenmelidir.
* **Detay**: `download_asset`, `read_script` veya `write_script` gibi araçlarda girilen dosya yolları, çalıştırılmadan önce regex doğrulamasına tabi tutulmalı ve kesinlikle proje sınırları dışına (`Assets/` dışı veya üst klasörler) çıkılmasına izin verilmemelidir.
* **Doğrulama Kriteri**: AI'a kasıtlı olarak `read_script` parametresi olarak `"../../Windows/System32/drivers/etc/hosts"` veya `"Assets/../../secret.txt"` dizini gönderilir. Sunucunun `403 Forbidden: Invalid file path / Directory escape detected` hatası vererek işlemi durdurduğu doğrulanır.
