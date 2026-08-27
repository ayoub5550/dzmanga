# تطبيق dzmanga لأندرويد (TWA)

التطبيق **ليس** كوداً منفصلاً: هو Trusted Web Activity يفتح
`https://www.dzmanga.dpdns.org` في محرّك كروم بلا شريط عناوين. يعني أن أي تعديل
في الموقع يظهر في التطبيق فوراً، والإعلانات هي إعلانات الموقع نفسها بلا SDK ولا
كود إضافي.

## الملفات

- `twa-manifest.json` — إعداد البناء (الاسم، الألوان، الأيقونة، الإصدار، الصلاحيات).
- بصمة التوقيع منشورة في `src/assetlinks.json` → تُقدَّم على
  `/.well-known/assetlinks.json`. **بدونها يظهر شريط المتصفّح داخل التطبيق.**
- الملف المبني يوضع في `dist-app/dzmanga.apk` على السيرفر (خارج git — ثنائي كبير)
  ويُقدَّم من `/download/dzmanga.apk`.
- **الـkeystore على السيرفر في `/root/dzmanga-android/`** (خارج git تماماً).
  لو ضاع فلن تستطيع إصدار تحديث بنفس التوقيع — احتفظ بنسخة احتياطية خارج السيرفر.

## إعادة البناء (نسخة جديدة)

```bash
# مرة واحدة: JDK 17 + Android SDK (build-tools 36.1.0) + bubblewrap
npm i -g @bubblewrap/cli
# ملاحظة: bubblewrap يتوقّع مجلد SDK فيه bin/ أو tools/ — اعمل symlink:
#   ln -s $SDK/cmdline-tools/latest/bin $SDK/bin

cd android && cp /root/dzmanga-android/android.keystore .
# ارفع appVersion و appVersionCode في twa-manifest.json قبل كل إصدار
export BUBBLEWRAP_KEYSTORE_PASSWORD='...' BUBBLEWRAP_KEY_PASSWORD='...'
bubblewrap update --skipVersionUpgrade
bubblewrap build --skipPwaValidation      # ينتج app-release-signed.apk + .aab
cp app-release-signed.apk /opt/dzmanga/dist-app/dzmanga.apk
# حدّث APP_VERSION في systemd/البيئة إن تغيّر الإصدار، ثم:
systemctl restart dzmanga
```

صفحة التحميل تقرأ **حجم الملف وتاريخه من القرص وقت الطلب**، فلا حاجة لتحديث
أرقام مكتوبة يدوياً — انسخ الملف فقط.

## لا تفعل هذا

- لا تضع الـkeystore أو الـAPK في git.
- لا تغيّر مفتاح التوقيع دون تحديث `src/assetlinks.json` (وإلا انكسر الربط
  وظهر شريط المتصفّح، ومستخدمو النسخة القديمة لن يقدروا يحدّثون فوقها).
- لا تغيّر `packageId` (`org.dpdns.dzmanga`) أبداً بعد أول توزيع.
