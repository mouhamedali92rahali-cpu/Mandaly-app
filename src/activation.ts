import { ACTIVATION_API_URL } from './config';

const ACTIVATED_KEY = 'mandaly-activated';
const DEVICE_ID_KEY = 'mandaly-device-id';
const CODE_KEY = 'mandaly-activation-code';

// Excludes visually-confusable characters (0/O, 1/I/L) since these codes are
// read off a printed box and typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function checksumChar(payload: string): string {
  let sum = 0;
  for (const ch of payload) sum += CODE_ALPHABET.indexOf(ch);
  return CODE_ALPHABET[sum % CODE_ALPHABET.length];
}

// MDLY-XXXX-XXXX: 7 random payload chars + 1 checksum char, so a mistyped
// code can be rejected locally, before ever calling the server.
function isValidFormat(code: string): boolean {
  const m = /^MDLY-([A-Z0-9]{4})-([A-Z0-9]{4})$/.exec(code);
  if (!m) return false;
  const payload = m[1] + m[2].slice(0, 3);
  const checksum = m[2][3];
  return checksumChar(payload) === checksum;
}

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID(); // no persistence — treated as a fresh device.
  }
}

export function isActivated(): boolean {
  try {
    return localStorage.getItem(ACTIVATED_KEY) === '1';
  } catch {
    return false;
  }
}

function markActivated(code: string): void {
  try {
    localStorage.setItem(ACTIVATED_KEY, '1');
    localStorage.setItem(CODE_KEY, code);
  } catch {
    // no persistence available — app still works this session, but will
    // ask again next time. Rare (private browsing with storage blocked).
  }
}

interface ActivateResponse {
  ok: boolean;
  reason?: 'not_found' | 'limit_reached' | 'bad_request';
}

export interface ActivationElements {
  gate: HTMLElement;
  form: HTMLFormElement;
  input: HTMLInputElement;
  submitBtn: HTMLButtonElement;
  errorMsg: HTMLElement;
}

/**
 * Gates the rest of the app behind a one-time activation code check. Once
 * activated, the result is stored in localStorage and this never touches
 * the network again on this device — onActivated() fires immediately on
 * every later load without opening the gate at all.
 */
export function initActivationGate(el: ActivationElements, onActivated: () => void): void {
  if (isActivated()) {
    onActivated();
    return;
  }

  el.gate.hidden = false;

  // Light auto-formatting as the customer types a code off the printed box.
  el.input.addEventListener('input', () => {
    let raw = el.input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.startsWith('MDLY')) raw = raw.slice(4);
    raw = raw.slice(0, 8);
    let formatted = 'MDLY-' + raw.slice(0, 4);
    if (raw.length > 4) formatted += '-' + raw.slice(4);
    el.input.value = formatted;
    el.errorMsg.hidden = true;
  });

  function showError(msg: string): void {
    el.errorMsg.textContent = msg;
    el.errorMsg.hidden = false;
  }

  function setLoading(loading: boolean): void {
    el.submitBtn.disabled = loading;
    el.submitBtn.textContent = loading ? 'جارٍ التحقق...' : 'تفعيل';
  }

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = el.input.value.trim().toUpperCase();

    if (!isValidFormat(code)) {
      showError('الكود غير صحيح — تحقّقوا من الأحرف وأعيدوا المحاولة.');
      return;
    }

    setLoading(true);
    const deviceId = getDeviceId();

    fetch(`${ACTIVATION_API_URL}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, deviceId }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as ActivateResponse;
        if (res.ok && data.ok) {
          markActivated(code);
          el.gate.hidden = true;
          onActivated();
          return;
        }
        if (data.reason === 'limit_reached') {
          showError('تم استخدام هذا الكود على جهازين بالفعل — الحد الأقصى المسموح به.');
        } else if (data.reason === 'not_found') {
          showError('الكود غير صحيح. تحقّقوا من الكود المطبوع داخل الصندوق.');
        } else {
          showError('حدث خطأ غير متوقع. حاولوا مرة أخرى.');
        }
      })
      .catch(() => {
        showError('تعذّر الاتصال بالإنترنت. تحقّقوا من الاتصال وحاولوا مرة أخرى.');
      })
      .finally(() => setLoading(false));
  });
}
