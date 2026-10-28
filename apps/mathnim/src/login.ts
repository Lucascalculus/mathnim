// Sign in with an emailed code: the address, then six digits (sent on the
// sixth). Used in the settings panel and on the studio page.
import { esc, t, ui_lang } from '@mathnim/present';
import { send_code, verify_code } from './account';

const CSS = `
.login{display:flex;flex-direction:column;gap:10px}
.login form{display:flex;gap:8px}
.login .mn-input{flex:1;min-width:0;height:38px;padding:0 12px;font-size:15px}
.login .mn-btn{flex:none;height:38px;padding:0 14px;font-size:14px}
.login .code{letter-spacing:.3em;font-variant-numeric:tabular-nums;font-family:ui-monospace,Menlo,monospace}
.login-note{margin:0;font-size:13px;color:var(--mn-muted)}
.login-note b{color:var(--mn-fg);font-weight:600}
.login-err{margin:0;font-size:13px;color:var(--mn-bad)}
.login-again{align-self:flex-start;border:0;background:none;padding:0;font:inherit;font-size:13px;color:var(--mn-muted);cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.login-again:hover{color:var(--mn-accent)}
`;
let injected = false;

/** The sign-in form; `done` runs once signed in. */
export function login_form(done?: () => void): HTMLElement {
  if (!injected) {
    injected = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.append(s);
  }
  const el = document.createElement('div');
  el.className = 'login';
  let email = '';
  const ask_email = (err = '') => {
    el.innerHTML = `<form><input class="mn-input" type="email" name="email" autocomplete="email" required placeholder="${esc(t('email'))}" value="${esc(email)}" aria-label="${esc(t('email'))}"><button class="mn-btn primary">${esc(t('send_code'))}</button></form>${err ? `<p class="login-err" role="alert">${esc(err)}</p>` : ''}`;
    const form = el.querySelector('form')!;
    const input = form.querySelector('input')!;
    form.onsubmit = async (e) => {
      e.preventDefault();
      email = input.value.trim();
      const btn = form.querySelector('button')!;
      btn.disabled = true;
      const r = await send_code(email, ui_lang());
      btn.disabled = false;
      if (r.error) return ask_email(message(r.error));
      ask_code('', r.dev_code);
    };
  };
  const ask_code = (err = '', dev_code?: string) => {
    el.innerHTML = `<p class="login-note">${t('code_sent', { email: `<b>${esc(email)}</b>` })}</p>
      <form><input class="mn-input code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required placeholder="000000" aria-label="${esc(t('code'))}"><button class="mn-btn primary">${esc(t('sign_in'))}</button></form>
      ${err ? `<p class="login-err" role="alert">${esc(err)}</p>` : ''}
      <button type="button" class="login-again">${esc(t('other_email'))}</button>`;
    const form = el.querySelector('form')!;
    const input = form.querySelector('input')!;
    if (dev_code) input.value = dev_code; // the dev server returns the code instead of mailing it
    input.focus();
    const submit = async () => {
      const btn = form.querySelector('button')!;
      btn.disabled = input.disabled = true;
      const r = await verify_code(email, input.value);
      if (r.error) return ask_code(message(r.error));
      done?.();
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      void submit();
    };
    input.oninput = () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 6);
      if (input.value.length === 6) void submit();
    };
    el.querySelector<HTMLButtonElement>('.login-again')!.onclick = () => ask_email();
  };
  ask_email();
  return el;
}

/** The server's message in the learner's words (the server speaks English). */
function message(e: string): string {
  if (e === 'offline') return t('net_down');
  if (/wrong code/i.test(e)) return t('code_wrong');
  if (/expired/i.test(e)) return t('code_expired');
  if (/wait|too many/i.test(e)) return t('code_wait');
  if (/not configured/i.test(e)) return t('accounts_off');
  if (/valid address/i.test(e)) return t('email_bad');
  return e;
}
