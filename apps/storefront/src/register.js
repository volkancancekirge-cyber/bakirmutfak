import './admin.css';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(rawUrl)
  && apiKey.length > 20 && !apiKey.startsWith('YOUR_');
const $ = (selector) => document.querySelector(selector);

$('#register-app').innerHTML = `
<div class="login-wrap">
  <div class="login-aside">
    <span>BAKIR MUTFAK / SIGNATURE</span>
    <h2>Mağazanızın<br><em>kontrol merkezi.</em></h2>
    <p>Ürün, stok, fiyat ve XML yönetimi tek hesapta.</p>
    <div class="copper-orb"></div>
  </div>
  <div class="login-panel">
    <a class="backlink" href="/admin.html">← Yönetici girişine dön</a>
    <div class="login-card">
      <span class="eyebrow">İLK YÖNETİCİ HESABI</span>
      <h1>Hesabını oluştur.</h1>
      <p>Bir e-posta adresi ve güçlü bir şifre seç. Şifren yalnızca Supabase kimlik doğrulama servisine gönderilir, bu sohbetle paylaşılmaz.</p>
      <div id="registration-feedback" role="status" class="alert" hidden></div>
      <form id="register-form">
        <label for="register-email">E-posta adresin
          <input id="register-email" name="email" type="email" autocomplete="email" maxlength="254" required/>
        </label>
        <label for="register-password">Güçlü şifre
          <input id="register-password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="200" required/>
        </label>
        <label for="register-confirm">Şifreyi tekrarla
          <input id="register-confirm" name="confirm" type="password" autocomplete="new-password" minlength="12" maxlength="200" required/>
        </label>
        <button class="primary" type="submit">Hesap oluştur →</button>
      </form>
      <p class="info-note">Bu kayıt otomatik yönetici yetkisi vermez. E-posta adresini doğruladıktan sonra hesabına mağaza sahibi yetkisi tanımlanacaktır. Sipariş ve ödemeler hâlâ kapalıdır.</p>
      <small>Güvenliğiniz için şifrenizi kimseyle, ChatGPT ile bile paylaşmayın.</small>
    </div>
  </div>
</div>
`;

if (!configured) {
  const el = $('#registration-feedback');
  el.textContent = 'Supabase bağlantısı kurulmadı. Kayıt işlemi şu anda kullanılamıyor.';
  el.className = 'alert error';
  el.hidden = false;
  $('#register-form button').disabled = true;
}

$('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const email = String(data.get('email') || '').trim().toLowerCase();
  const password = String(data.get('password') || '');
  const confirmation = String(data.get('confirm') || '');
  const message = $('#registration-feedback');
  const button = form.querySelector('button[type="submit"]');

  message.hidden = false;
  if (password.length < 12 || password !== confirmation) {
    message.textContent = 'Şifren en az 12 karakter olmalı ve iki şifre alanı aynı olmalı.';
    message.className = 'alert error';
    return;
  }

  button.disabled = true;
  button.textContent = 'Hesap oluşturuluyor…';

  try {
    const redirect = new URL('/admin.html', location.origin).toString();
    const response = await fetch(
      rawUrl.replace(/\/+$/, '') + '/auth/v1/signup?redirect_to=' + encodeURIComponent(redirect),
      {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.msg || body.message || body.error_description || 'Hesap oluşturulamadı.');
    }
    form.reset();
    message.className = 'alert';
    message.textContent = 'Kayıt isteği alındı. Gelen e-postadaki doğrulama bağlantısını aç. Ardından bu sohbete yalnızca kayıt e-posta adresini bildir; yetkinin tanımlanması için hesap doğrulaması yapılacak. Şifreni paylaşma.';
    form.hidden = true;
  } catch (error) {
    message.className = 'alert error';
    message.textContent = String(error.message || 'Bir hata oluştu.');
  } finally {
    button.disabled = false;
    button.textContent = 'Hesap oluştur →';
  }
});
