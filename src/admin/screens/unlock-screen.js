import { loginAdmin, registerAdmin } from '../admin-auth.js';
import { adminState } from '../admin-state.js';

export function renderUnlockScreen(container) {
  let isRegisterMode = false;

  const renderContent = () => {
    container.innerHTML = `
      <div class="flex items-center justify-center min-h-screen bg-[#0F172A] px-4 py-8 select-none">
        <div class="w-full max-w-[440px] bg-[#1E293B] border border-[#334155] rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          
          <!-- Decorative Glow -->
          <div class="absolute -top-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <!-- Header with Logo -->
          <div class="flex flex-col items-center text-center mb-8 relative z-10">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0F766E] to-[#0284C7] p-0.5 shadow-lg shadow-teal-900/40 mb-4 flex items-center justify-center">
              <div class="w-full h-full bg-[#0F172A] rounded-[14px] flex items-center justify-center">
                <i class="fa-solid fa-shapes text-2xl text-teal-400"></i>
              </div>
            </div>

            <h1 class="text-2xl font-bold text-white tracking-tight mb-1">Petty Bloom</h1>
            <div class="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-[10px] font-bold tracking-widest text-slate-300">ADMIN WEB PORTAL</span>
            </div>
          </div>

          <!-- Mode Switch Notice -->
          <div class="text-center mb-6">
            <p class="text-xs text-slate-400 font-medium">
              ${isRegisterMode 
                ? 'Create a new Administrator account in Firebase' 
                : 'Sign in with your Firebase Admin Email & Password'}
            </p>
          </div>

          <!-- Login/Register Form -->
          <form id="admin-login-form" class="space-y-4 relative z-10" autocomplete="off">
            <div id="login-error-alert" class="hidden p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2.5">
              <i class="fa-solid fa-circle-exclamation text-rose-400 text-base flex-shrink-0"></i>
              <span id="login-error-text">Invalid login credentials</span>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1.5 tracking-wide uppercase">Admin Email</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <i class="fa-solid fa-envelope text-sm"></i>
                </div>
                <input 
                  type="email" 
                  id="admin-email-input" 
                  required 
                  placeholder="admin@pettybloom.com" 
                  class="w-full pl-10 pr-4 py-3 bg-[#0F172A] border border-[#334155] rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all placeholder:text-slate-500"
                >
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1.5 tracking-wide uppercase">Password</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <i class="fa-solid fa-lock text-sm"></i>
                </div>
                <input 
                  type="password" 
                  id="admin-password-input" 
                  required 
                  minlength="6"
                  placeholder="••••••••" 
                  class="w-full pl-10 pr-11 py-3 bg-[#0F172A] border border-[#334155] rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all placeholder:text-slate-500"
                >
                <button 
                  type="button" 
                  id="toggle-password-btn" 
                  class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <i class="fa-solid fa-eye text-sm" id="toggle-password-icon"></i>
                </button>
              </div>
              ${isRegisterMode ? '<p class="text-[11px] text-slate-400 mt-1">Minimum 6 characters</p>' : ''}
            </div>

            <button 
              type="submit" 
              id="admin-login-submit" 
              class="w-full py-3.5 px-4 bg-[#0F766E] hover:bg-[#0D9488] active:bg-[#115E59] text-white font-bold text-sm rounded-xl shadow-lg shadow-teal-900/30 transition-all duration-200 flex items-center justify-center gap-2 mt-4 group"
            >
              <span id="login-btn-spinner" class="hidden w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span id="login-btn-text">${isRegisterMode ? 'Register New Admin Account' : 'Unlock Admin Portal'}</span>
              <i class="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition-transform" id="login-btn-arrow"></i>
            </button>
          </form>

          <!-- Toggle Mode (Sign In vs Register) -->
          <div class="mt-6 pt-5 border-t border-slate-800/80 text-center relative z-10 flex flex-col items-center gap-2">
            <button 
              type="button" 
              id="toggle-auth-mode-btn" 
              class="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
            >
              ${isRegisterMode 
                ? 'Already have an admin account? Sign In' 
                : 'Need to create an Admin account? Click here to Register'}
            </button>
            <p class="text-[11px] text-slate-500">
              Firebase Project: <strong class="text-slate-400">petty-bloom</strong>
            </p>
          </div>

        </div>
      </div>
    `;

    // Wire events
    const form = container.querySelector('#admin-login-form');
    const emailInput = container.querySelector('#admin-email-input');
    const passInput = container.querySelector('#admin-password-input');
    const toggleBtn = container.querySelector('#toggle-password-btn');
    const toggleIcon = container.querySelector('#toggle-password-icon');
    const submitBtn = container.querySelector('#admin-login-submit');
    const btnSpinner = container.querySelector('#login-btn-spinner');
    const btnText = container.querySelector('#login-btn-text');
    const btnArrow = container.querySelector('#login-btn-arrow');
    const errorAlert = container.querySelector('#login-error-alert');
    const errorText = container.querySelector('#login-error-text');
    const toggleModeBtn = container.querySelector('#toggle-auth-mode-btn');

    toggleModeBtn.addEventListener('click', () => {
      isRegisterMode = !isRegisterMode;
      renderContent();
    });

    toggleBtn.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      toggleIcon.className = isPass ? 'fa-solid fa-eye-slash text-sm' : 'fa-solid fa-eye text-sm';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorAlert.classList.add('hidden');

      submitBtn.disabled = true;
      btnSpinner.classList.remove('hidden');
      btnArrow.classList.add('hidden');
      btnText.textContent = isRegisterMode ? 'Registering Account...' : 'Verifying Credentials...';

      const email = emailInput.value.trim();
      const password = passInput.value;

      try {
        if (isRegisterMode) {
          await registerAdmin(email, password);
          adminState.showToast('success', 'Admin account created and logged in!');
        } else {
          await loginAdmin(email, password);
          adminState.showToast('success', 'Admin portal unlocked!');
        }
      } catch (err) {
        console.error('Auth error:', err);
        let msg = err.message || 'Authentication failed';
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
          msg = 'Incorrect email or password. Please verify and try again.';
        } else if (err.code === 'auth/user-not-found') {
          msg = 'No account found with this email. Click "Click here to Register" below to create it.';
        } else if (err.code === 'auth/email-already-in-use') {
          msg = 'This email is already registered. Please switch to Sign In.';
        } else if (err.code === 'auth/weak-password') {
          msg = 'Password is too weak. Please use at least 6 characters.';
        }
        errorText.textContent = msg;
        errorAlert.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        btnSpinner.classList.add('hidden');
        btnArrow.classList.remove('hidden');
        btnText.textContent = isRegisterMode ? 'Register New Admin Account' : 'Unlock Admin Portal';
      }
    });
  };

  renderContent();
}
