/**
 * GymGo – Client Application Controller (Modular Architecture)
 * 
 * Note: The live application served by backend/server.js is `frontend/index.html`,
 * which contains the full-stack integrated Single Page Application with dynamic themes,
 * Admin Command Center, portal-specific authentication routing, Travel Gyms,
 * AI Coach, Workout tracker, Passport, and GymGram social feed.
 * 
 * This file is maintained for modular reference alongside `api.js` and `sound.js`.
 */
(function() {
  // DOM Elements
  const app = document.getElementById('app');
  const home = document.getElementById('home');
  const travel = document.getElementById('travel');
  const coach = document.getElementById('coach');
  const wo = document.getElementById('wo');
  const passport = document.getElementById('passport');
  const gymgram = document.getElementById('gymgram');
  const passes = document.getElementById('passes');
  const profile = document.getElementById('profile');
  const owner = document.getElementById('owner');
  const toast = document.getElementById('toast');
  const sheet = document.getElementById('sheet');
  const dim = document.getElementById('dim');
  const reqpill = document.getElementById('reqpill');

  let animTimer = null;
  let toastTimer = null;
  let currentUser = API.getCurrentUser();
  let currentBooking = null;

  // ------------------------------------------------------------------------
  // Helper Utilities
  // ------------------------------------------------------------------------
  function say(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('on'), 2600);
  }

  function hash(str) {
    let h = 7;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function fmt(d) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function rs(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function esc(t) {
    return String(t || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function qrSvg(id) {
    const h = hash(id || 'GYMGO');
    let cells = '';
    for (let k = 0; k < 81; k++) {
      const r = Math.floor(k / 9);
      const cc = k % 9;
      const fin = (r < 3 && cc < 3) || (r < 3 && cc > 5) || (r > 5 && cc < 3);
      const isDark = (fin && !(r === 1 && cc % 6 === 1)) || (!fin && ((h >> (k % 24)) + k * 7) % 3 === 0);
      cells += `<i class="${isDark ? 'd' : ''}"></i>`;
    }
    return cells;
  }

  function tickNumber(id, to, dur = 1200, delay = 0) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '0';
    setTimeout(() => {
      const s = performance.now();
      (function f(n) {
        const k = Math.min(1, (n - s) / dur);
        const v = Math.round(to * (1 - Math.pow(1 - k, 3)));
        el.textContent = v;
        if (k < 1) requestAnimationFrame(f);
      })(s);
    }, delay);
  }

  function openSheet(contentHtml) {
    sheet.innerHTML = contentHtml;
    dim.classList.add('on');
    sheet.classList.add('on');
  }

  function closeSheet() {
    sheet.classList.remove('on');
    dim.classList.remove('on');
  }
  dim.onclick = closeSheet;

  // ------------------------------------------------------------------------
  // Navigation & Scene Switching
  // ------------------------------------------------------------------------
  const SCENES = ['home', 'travel', 'coach', 'wo', 'passport', 'gymgram', 'passes', 'profile', 'owner'];

  function resetAllScenes() {
    SCENES.forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = 'none';
      document.body.classList.remove(`${s}Mode`);
    });
    app.style.display = 'none';
    app.classList.remove('out');
    closeSheet();
  }

  function showScene(sceneName) {
    resetAllScenes();
    const target = document.getElementById(sceneName);
    if (!target) return;

    document.body.classList.add(`${sceneName}Mode`);
    target.style.display = 'block';
    target.scrollTop = 0;
    target.classList.remove('play');
    void target.offsetWidth;
    target.classList.add('play');

    // Update bottom nav
    document.querySelectorAll('.nav div').forEach(tab => {
      const targetGo = tab.getAttribute('data-scene');
      tab.classList.toggle('on', targetGo === sceneName);
    });

    // Scene-specific initializations
    if (sceneName === 'home') initHome();
    if (sceneName === 'travel') initTravel();
    if (sceneName === 'coach') initCoach();
    if (sceneName === 'wo') initWorkout();
    if (sceneName === 'passport') initPassport();
    if (sceneName === 'gymgram') initGymgram();
    if (sceneName === 'passes') initPasses();
    if (sceneName === 'profile') initProfile();
    if (sceneName === 'owner') initOwner();
  }

  // ------------------------------------------------------------------------
  // Intro & Logo Animation
  // ------------------------------------------------------------------------
  // ------------------------------------------------------------------------
  // Intro, Auth & Registration Controller
  // ------------------------------------------------------------------------
  let selectedRegRole = 'athlete';
  let authAlertTimer = null;

  function showAuthAlert(msg, type = 'error', targetId = 'auth-alert') {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.className = `auth-alert ${type}`;
    const icon = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    el.innerHTML = `<span class="alert-icon">${icon}</span><span class="alert-text">${esc(msg)}</span>`;
    el.style.display = 'flex';
    clearTimeout(authAlertTimer);
    if (type !== 'error') {
      authAlertTimer = setTimeout(() => { el.style.display = 'none'; }, 4500);
    }
  }

  function hideAuthAlert(targetId = 'auth-alert') {
    const el = document.getElementById(targetId);
    if (el) el.style.display = 'none';
  }

  function setAuthTab(tabName) {
    SoundFX.tick();
    hideAuthAlert('auth-alert');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginPane = document.getElementById('auth-login-pane');
    const registerPane = document.getElementById('auth-register-pane');
    const authTitle = document.getElementById('auth-title');
    const authSub = document.getElementById('auth-sub');

    if (tabName === 'register') {
      tabLogin.classList.remove('on');
      tabLogin.setAttribute('aria-selected', 'false');
      tabRegister.classList.add('on');
      tabRegister.setAttribute('aria-selected', 'true');
      loginPane.style.display = 'none';
      registerPane.style.display = 'block';
      authTitle.textContent = 'CREATE ACCOUNT';
      authSub.textContent = 'Join GymGo to explore gyms, track workouts & access your AI coach.';
    } else {
      tabRegister.classList.remove('on');
      tabRegister.setAttribute('aria-selected', 'false');
      tabLogin.classList.add('on');
      tabLogin.setAttribute('aria-selected', 'true');
      registerPane.style.display = 'none';
      loginPane.style.display = 'block';
      authTitle.textContent = 'WELCOME BACK';
      authSub.textContent = 'Log in to sync your passes, workouts & AI coach.';
    }
  }

  function setRegisterRole(role) {
    SoundFX.tick();
    selectedRegRole = role;
    const btnAth = document.getElementById('role-btn-athlete');
    const btnOwn = document.getElementById('role-btn-owner');
    const ownerFields = document.getElementById('owner-extra-fields');

    if (role === 'owner') {
      btnAth.classList.remove('on');
      btnOwn.classList.add('on');
      if (ownerFields) ownerFields.style.display = 'block';
    } else {
      btnOwn.classList.remove('on');
      btnAth.classList.add('on');
      if (ownerFields) ownerFields.style.display = 'none';
    }
  }

  function checkPasswordStrength(pwd) {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score++;

    const bars = [
      document.getElementById('pwd-bar-1'),
      document.getElementById('pwd-bar-2'),
      document.getElementById('pwd-bar-3'),
      document.getElementById('pwd-bar-4')
    ];
    const strengthLabel = document.getElementById('pwd-strength-val');

    bars.forEach(b => { if (b) b.className = 'meter-bar'; });

    if (!pwd || pwd.length === 0) {
      if (strengthLabel) { strengthLabel.textContent = 'None'; strengthLabel.style.color = 'var(--muted)'; }
      return;
    }

    if (score === 1) {
      if (bars[0]) bars[0].classList.add('weak');
      if (strengthLabel) { strengthLabel.textContent = 'Weak'; strengthLabel.style.color = 'var(--accent-coral)'; }
    } else if (score === 2) {
      if (bars[0]) bars[0].classList.add('fair');
      if (bars[1]) bars[1].classList.add('fair');
      if (strengthLabel) { strengthLabel.textContent = 'Fair'; strengthLabel.style.color = 'var(--accent-gold)'; }
    } else if (score === 3) {
      if (bars[0]) bars[0].classList.add('good');
      if (bars[1]) bars[1].classList.add('good');
      if (bars[2]) bars[2].classList.add('good');
      if (strengthLabel) { strengthLabel.textContent = 'Good'; strengthLabel.style.color = '#88ff3d'; }
    } else if (score >= 4) {
      bars.forEach(b => { if (b) b.classList.add('strong'); });
      if (strengthLabel) { strengthLabel.textContent = 'Strong (Optimal)'; strengthLabel.style.color = 'var(--accent)'; }
    }
  }

  function playIntro() {
    clearTimeout(animTimer);
    resetAllScenes();
    app.style.display = 'flex';
    app.classList.remove('go', 'login', 'out');
    void app.offsetWidth;
    app.classList.add('go');
    animTimer = setTimeout(() => {
      app.classList.add('login');
    }, 5200);
  }

  function showAuthCardImmediately() {
    clearTimeout(animTimer);
    resetAllScenes();
    app.style.display = 'flex';
    app.classList.add('go', 'login');
    app.classList.remove('out');
    setAuthTab('login');
  }

  const quickAuthBtn = document.getElementById('quick-auth-btn');
  if (quickAuthBtn) quickAuthBtn.onclick = showAuthCardImmediately;

  document.getElementById('replay').onclick = playIntro;
  document.getElementById('skip').onclick = () => {
    loginAs(currentUser.username || 'athlete');
  };

  async function loginAs(userVal, passVal = '123456', submitBtn = null) {
    clearTimeout(animTimer);
    hideAuthAlert('auth-alert');

    if (submitBtn) {
      submitBtn.disabled = true;
      const spinner = submitBtn.querySelector('.btn-spinner');
      if (spinner) spinner.style.display = 'inline-block';
    }

    try {
      const res = await API.auth.login(userVal, passVal);
      currentUser = res.user;

      // Remember me handling
      const rememberCheckbox = document.getElementById('remember-me');
      if (rememberCheckbox && rememberCheckbox.checked) {
        try { localStorage.setItem('gymgo_saved_username', userVal); } catch(e) {}
      }

      showAuthAlert('Success! Launching GymGo...', 'success');
      SoundFX.success();

      const nm = currentUser.name || userVal;
      const whoEl = document.getElementById('who');
      const avEl = document.getElementById('av');
      if (whoEl) whoEl.textContent = nm;
      if (avEl) avEl.textContent = (currentUser.avatar || nm.charAt(0)).toUpperCase();

      setTimeout(() => {
        if (currentUser.role === 'owner') {
          showScene('owner');
          say(`Welcome back, ${nm} (Gym Owner)`);
        } else {
          app.classList.add('out');
          setTimeout(() => {
            showScene('home');
            say(`Welcome back, ${nm}`);
          }, 350);
        }
        syncBookings();
      }, 500);

    } catch(err) {
      showAuthAlert(err.message || 'Login failed. Please check your username and password.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        const spinner = submitBtn.querySelector('.btn-spinner');
        if (spinner) spinner.style.display = 'none';
      }
    }
  }

  // Set up remembered username if available
  try {
    const savedU = localStorage.getItem('gymgo_saved_username');
    if (savedU && document.getElementById('u')) {
      document.getElementById('u').value = savedU;
    }
  } catch(e) {}

  // Login form submit
  const loginForm = document.getElementById('auth-login-pane');
  if (loginForm) {
    loginForm.onsubmit = (e) => {
      e.preventDefault();
      const u = document.getElementById('u').value.trim();
      const p = document.getElementById('p').value;
      const btn = document.getElementById('go');
      if (!u) {
        showAuthAlert('Please enter your username or registered email.', 'error');
        document.getElementById('u').focus();
        return;
      }
      if (!p) {
        showAuthAlert('Please enter your password.', 'error');
        document.getElementById('p').focus();
        return;
      }
      loginAs(u, p, btn);
    };
  }

  // Registration form submit
  const registerForm = document.getElementById('auth-register-pane');
  if (registerForm) {
    registerForm.onsubmit = async (e) => {
      e.preventDefault();
      hideAuthAlert('auth-alert');

      const name = document.getElementById('reg-name').value.trim();
      const username = document.getElementById('reg-u').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-p').value;
      const homeCity = document.getElementById('reg-city').value;
      const terms = document.getElementById('reg-terms');
      const submitBtn = document.getElementById('btn-register');

      if (!name) {
        showAuthAlert('Please enter your full name.', 'error');
        document.getElementById('reg-name').focus();
        return;
      }
      if (!username || username.length < 3) {
        showAuthAlert('Username must be at least 3 characters long.', 'error');
        document.getElementById('reg-u').focus();
        return;
      }
      if (!email || !email.includes('@')) {
        showAuthAlert('Please enter a valid email address.', 'error');
        document.getElementById('reg-email').focus();
        return;
      }
      if (!password || password.length < 6) {
        showAuthAlert('Password must be at least 6 characters.', 'error');
        document.getElementById('reg-p').focus();
        return;
      }

      let gymName = '';
      let area = '';
      if (selectedRegRole === 'owner') {
        gymName = document.getElementById('reg-gym-name').value.trim();
        area = document.getElementById('reg-gym-area').value.trim();
        if (!gymName) {
          showAuthAlert('Please enter your Gym / Facility Name.', 'error');
          document.getElementById('reg-gym-name').focus();
          return;
        }
        if (!area) {
          showAuthAlert('Please enter the area/neighborhood of your facility.', 'error');
          document.getElementById('reg-gym-area').focus();
          return;
        }
      }

      if (terms && !terms.checked) {
        showAuthAlert('Please agree to the GymGo terms to continue.', 'error');
        return;
      }

      submitBtn.disabled = true;
      const spinner = submitBtn.querySelector('.btn-spinner');
      if (spinner) spinner.style.display = 'inline-block';

      try {
        const payload = {
          name,
          username,
          email,
          password,
          role: selectedRegRole,
          homeCity,
          gymName: selectedRegRole === 'owner' ? gymName : undefined,
          area: selectedRegRole === 'owner' ? area : undefined
        };

        const res = await API.auth.register(payload);
        currentUser = res.user;

        showAuthAlert('Account created successfully! Launching your portal...', 'success');
        SoundFX.success();

        const nm = currentUser.name || username;
        const whoEl = document.getElementById('who');
        const avEl = document.getElementById('av');
        if (whoEl) whoEl.textContent = nm;
        if (avEl) avEl.textContent = (currentUser.avatar || nm.charAt(0)).toUpperCase();

        setTimeout(() => {
          if (currentUser.role === 'owner') {
            showScene('owner');
            say(`Facility registered: ${currentUser.gymName}`);
          } else {
            app.classList.add('out');
            setTimeout(() => {
              showScene('home');
              say(`Welcome to GymGo, ${nm}!`);
            }, 350);
          }
          syncBookings();
        }, 600);

      } catch(err) {
        showAuthAlert(err.message || 'Registration failed. Please try a different username or email.', 'error');
      } finally {
        submitBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
      }
    };
  }

  // Tab click listeners
  const tabLoginBtn = document.getElementById('tab-login');
  const tabRegBtn = document.getElementById('tab-register');
  if (tabLoginBtn) tabLoginBtn.onclick = () => setAuthTab('login');
  if (tabRegBtn) tabRegBtn.onclick = () => setAuthTab('register');

  // Quick switch links
  const linkGotoReg = document.getElementById('link-goto-register');
  const linkGotoLogin = document.getElementById('link-goto-login');
  if (linkGotoReg) linkGotoReg.onclick = () => setAuthTab('register');
  if (linkGotoLogin) linkGotoLogin.onclick = () => setAuthTab('login');

  // Role selector buttons
  const roleBtnAth = document.getElementById('role-btn-athlete');
  const roleBtnOwn = document.getElementById('role-btn-owner');
  if (roleBtnAth) roleBtnAth.onclick = () => setRegisterRole('athlete');
  if (roleBtnOwn) roleBtnOwn.onclick = () => setRegisterRole('owner');

  // Password visibility toggle helpers
  function setupPwdToggle(toggleBtnId, inputId) {
    const btn = document.getElementById(toggleBtnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    btn.onclick = () => {
      SoundFX.tick();
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      const eyeShow = btn.querySelector('.eye-show');
      const eyeHide = btn.querySelector('.eye-hide');
      if (eyeShow && eyeHide) {
        eyeShow.style.display = isPwd ? 'none' : 'block';
        eyeHide.style.display = isPwd ? 'block' : 'none';
      }
    };
  }
  setupPwdToggle('pwd-toggle-login', 'p');
  setupPwdToggle('pwd-toggle-reg', 'reg-p');

  // Password strength meter listener
  const regPasswordInput = document.getElementById('reg-p');
  if (regPasswordInput) {
    regPasswordInput.addEventListener('input', (e) => {
      checkPasswordStrength(e.target.value);
    });
  }

  // Demo accounts buttons
  const demoAth = document.getElementById('demo-athlete');
  const demoOwn = document.getElementById('demo-owner');
  if (demoAth) demoAth.onclick = () => loginAs('athlete', '123456');
  if (demoOwn) demoOwn.onclick = () => loginAs('owner', '123456');

  // ------------------------------------------------------------------------
  // Forgot Password / Recovery Modal Flow
  // ------------------------------------------------------------------------
  const forgotModal = document.getElementById('forgot-modal');
  const btnForgotPw = document.getElementById('btn-forgot-pw');
  const btnCloseForgot = document.getElementById('btn-close-forgot');
  const btnBackToLogin = document.getElementById('btn-back-to-login');
  const btnSendResetCode = document.getElementById('btn-send-reset-code');
  const btnSubmitNewPassword = document.getElementById('btn-submit-new-password');
  const forgotStep1 = document.getElementById('forgot-step-1');
  const forgotStep2 = document.getElementById('forgot-step-2');

  function openForgotModal() {
    SoundFX.tick();
    if (forgotModal) {
      forgotModal.style.display = 'flex';
      hideAuthAlert('forgot-alert');
      if (forgotStep1) forgotStep1.style.display = 'block';
      if (forgotStep2) forgotStep2.style.display = 'none';
      const identInput = document.getElementById('forgot-identity');
      if (identInput) {
        identInput.value = document.getElementById('u')?.value || 'athlete';
        identInput.focus();
      }
    }
  }

  function closeForgotModal() {
    if (forgotModal) forgotModal.style.display = 'none';
  }

  if (btnForgotPw) btnForgotPw.onclick = openForgotModal;
  if (btnCloseForgot) btnCloseForgot.onclick = closeForgotModal;
  if (btnBackToLogin) btnBackToLogin.onclick = closeForgotModal;
  if (forgotModal) {
    forgotModal.onclick = (e) => {
      if (e.target === forgotModal) closeForgotModal();
    };
  }

  if (btnSendResetCode) {
    btnSendResetCode.onclick = async () => {
      const ident = document.getElementById('forgot-identity').value.trim();
      if (!ident) {
        showAuthAlert('Please enter your username or email.', 'error', 'forgot-alert');
        return;
      }
      btnSendResetCode.disabled = true;
      try {
        const res = await API.auth.forgotPassword(ident);
        showAuthAlert(res.message || 'Recovery code generated! Enter below to set a new password.', 'success', 'forgot-alert');
        SoundFX.like();
        if (forgotStep1) forgotStep1.style.display = 'none';
        if (forgotStep2) forgotStep2.style.display = 'block';
        if (res.demoCode) {
          const codeInput = document.getElementById('reset-code');
          if (codeInput) codeInput.value = res.demoCode;
        }
      } catch(err) {
        showAuthAlert(err.message || 'Could not find account. Please verify username/email.', 'error', 'forgot-alert');
      } finally {
        btnSendResetCode.disabled = false;
      }
    };
  }

  if (btnSubmitNewPassword) {
    btnSubmitNewPassword.onclick = async () => {
      const ident = document.getElementById('forgot-identity').value.trim();
      const code = document.getElementById('reset-code').value.trim();
      const newPwd = document.getElementById('reset-new-password').value;

      if (!newPwd || newPwd.length < 4) {
        showAuthAlert('Please enter a new password (at least 4 characters).', 'error', 'forgot-alert');
        return;
      }

      btnSubmitNewPassword.disabled = true;
      try {
        const res = await API.auth.resetPassword(ident, code, newPwd);
        SoundFX.success();
        showAuthAlert('Password updated! Redirecting to login...', 'success', 'forgot-alert');
        setTimeout(() => {
          closeForgotModal();
          setAuthTab('login');
          const uInput = document.getElementById('u');
          const pInput = document.getElementById('p');
          if (uInput) uInput.value = ident;
          if (pInput) pInput.value = newPwd;
          showAuthAlert('Password updated successfully. You can now log in!', 'success', 'auth-alert');
        }, 1200);
      } catch(err) {
        showAuthAlert(err.message || 'Password reset failed.', 'error', 'forgot-alert');
      } finally {
        btnSubmitNewPassword.disabled = false;
      }
    };
  }

  // ------------------------------------------------------------------------
  // Home Dashboard
  // ------------------------------------------------------------------------
  function initHome() {
    tickNumber('streak', currentUser.streak || 47, 1400, 400);
    tickNumber('match', currentUser.matchPct || 96, 1400, 700);
    updatePill();
  }

  // Handle Quick Actions and Nav Links
  document.addEventListener('click', (ev) => {
    const target = ev.target.closest('[data-go], [data-scene]');
    if (!target) return;

    const navDest = target.getAttribute('data-scene');
    if (navDest) {
      showScene(navDest);
      return;
    }

    const go = target.getAttribute('data-go');
    if (go === 'Travel Gym' || go === 'Search' || go === 'Discover') showScene('travel');
    else if (go === 'AI Coach') showScene('coach');
    else if (go === 'Workout Session') showScene('wo');
    else if (go === 'Gym Passport') showScene('passport');
    else if (go === 'GymGram') showScene('gymgram');
    else if (go === 'My Passes') showScene('passes');
    else if (go === 'Profile') showScene('profile');
    else {
      say(`${go} opened`);
    }
  });

  // ------------------------------------------------------------------------
  // Travel Gym & Booking Workflow
  // ------------------------------------------------------------------------
  let CITIES = {
    'Vijayawada': ['Tadepalli', 'Benz Circle', 'Labbipet', 'Governorpet', 'Patamata', 'Auto Nagar', 'Gunadala'],
    'Guntur': ['Brodipet', 'Arundelpet', 'Lakshmipuram', 'Pattabhipuram'],
    'Visakhapatnam': ['MVP Colony', 'Dwaraka Nagar', 'Gajuwaka', 'Madhurawada'],
    'Hyderabad': ['Madhapur', 'Gachibowli', 'Kondapur', 'Jubilee Hills', 'Banjara Hills'],
    'Bengaluru': ['Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield'],
    'Chennai': ['T Nagar', 'Adyar', 'Velachery', 'Anna Nagar'],
    'Mumbai': ['Andheri', 'Bandra', 'Powai', 'Thane'],
    'Delhi': ['Saket', 'Dwarka', 'Rohini', 'Connaught Place']
  };

  const PLANS = [
    ['1 Day', 1, 1],
    ['1 Week', 7, 5],
    ['1 Month', 30, 12],
    ['3 Months', 90, 30]
  ];

  let curCity = '';
  let curArea = '';
  let gymList = [];

  function initTravel() {
    document.getElementById('back').onclick = () => showScene('home');
    API.gyms.getCities().then(res => {
      if (res.cities) CITIES = res.cities;
    }).catch(() => {});
  }

  function lev(a, b) {
    let m = [];
    for (let i = 0; i <= b.length; i++) m[i] = [i];
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1));
      }
    }
    return m[b.length][a.length];
  }

  function findCities(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2) return [];
    return Object.keys(CITIES).filter(c => {
      const l = c.toLowerCase();
      return l.indexOf(q) === 0 || (q.length >= 4 && (lev(q, l) <= 2 || lev(q, l.slice(0, q.length)) <= 1));
    });
  }

  const cityIn = document.getElementById('city');
  const sug = document.getElementById('sug');
  const areaBox = document.getElementById('areaBox');
  const areasEl = document.getElementById('areas');
  const resEl = document.getElementById('res');

  function pickCity(c) {
    curCity = c;
    cityIn.value = c;
    sug.innerHTML = '';
    curArea = '';
    resEl.className = 'step';
    resEl.innerHTML = '';
    document.getElementById('cn').textContent = c.toUpperCase();
    areasEl.innerHTML = (CITIES[c] || []).map(a => `<span class="chip" data-a="${a}">${a}</span>`).join('');
    areaBox.className = 'step show';
  }

  async function pickArea(a) {
    curArea = a;
    try {
      const res = await API.gyms.getGyms({ city: curCity, area: a });
      gymList = res.gyms || [];
    } catch(e) {
      gymList = [];
    }

    // Fallback if empty
    if (!gymList.length) {
      const POOL = ['Iron Nation', 'FitZone', 'Muscle Factory', 'Beast Mode', 'Power House', 'Pulse Fitness'];
      gymList = POOL.map((name, i) => ({
        id: 'gym_fb_' + i,
        name,
        city: curCity,
        area: a,
        rating: +(4.2 + (i * 0.15)).toFixed(1),
        reviews: 120 + i * 45,
        distance: +(0.5 + i * 0.4).toFixed(1),
        dayPrice: 120 + i * 20,
        tags: ['Free weights', 'AC', 'Squat rack', 'Showers'],
        openHours: '5:30 AM - 10:30 PM'
      }));
    }

    resEl.innerHTML = `
      <div class="lbl">3 · GYMS IN ${a.toUpperCase()}<small>${gymList.length} found</small></div>
      ${gymList.map((g, i) => {
        const gr = g.rating >= 4.7 ? ['Excellent', 'gE'] : g.rating >= 4.2 ? ['Good', 'gG'] : ['Basic', 'gB'];
        const ini = g.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
        const hue = hash(g.name) % 360;
        return `
          <div class="gc" style="animation-delay:${0.1 + i * 0.08}s">
            <div class="gt">
              <div class="gav" style="background:linear-gradient(135deg, hsl(${hue},70%,48%), hsl(${(hue+40)%360},60%,24%))">${ini}</div>
              <div class="gi">
                <b>${g.name}</b>
                <div class="rt">
                  <span class="star">★</span> <b>${g.rating.toFixed(1)}</b> <small>(${g.reviews || 95}) · ${g.distance || 0.8} km</small>
                </div>
              </div>
              <span class="gr ${gr[1]}">${gr[0]}</span>
            </div>
            <div class="tg">${(g.tags || []).map(t => `<span>${t}</span>`).join('')}</div>
            <div class="gb">
              <div class="fr">From <b>₹${g.dayPrice || 150}</b>/day</div>
              <button class="bk" data-gym-idx="${i}">BOOK NOW</button>
            </div>
          </div>
        `;
      }).join('')}
    `;
    resEl.className = 'step show';
    setTimeout(() => resEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }

  cityIn.addEventListener('input', () => {
    const q = cityIn.value;
    const matches = findCities(q);
    if (matches.length && q.trim().length >= 5 && lev(q.trim().toLowerCase(), matches[0].toLowerCase()) <= 2) {
      pickCity(matches[0]);
      return;
    }
    sug.innerHTML = matches.slice(0, 4).map(c => `
      <button data-c="${c}">${c} <small>· ${(CITIES[c] || []).length} areas</small></button>
    `).join('');
  });

  travel.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-c], [data-a], .bk');
    if (!t) return;

    if (t.hasAttribute('data-c')) {
      pickCity(t.getAttribute('data-c'));
    } else if (t.hasAttribute('data-a')) {
      areasEl.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
      t.classList.add('on');
      pickArea(t.getAttribute('data-a'));
    } else if (t.classList.contains('bk')) {
      const idx = +t.getAttribute('data-gym-idx');
      openPassBookingSheet(gymList[idx]);
    }
  });

  // ------------------------------------------------------------------------
  // Booking Sheet & Payment Simulation
  // ------------------------------------------------------------------------
  function openPassBookingSheet(gym) {
    let selPlan = -1;
    let selDay = 0;
    const days = [0, 1, 2, 3, 4].map(o => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + o);
      return d;
    });

    const sheetHtml = `
      <div class="grab"></div>
      <h4>${gym.name}</h4>
      <p>${curArea}, ${curCity} · ★ ${gym.rating.toFixed(1)}</p>
      <div class="lbl">CHOOSE YOUR PASS</div>
      ${PLANS.map((p, i) => {
        const price = (gym.dayPrice || 150) * p[2];
        const sub = i === 0 ? 'Try it out' : `₹${Math.round(price / p[1])}/day · save ${Math.round((1 - price / ((gym.dayPrice || 150) * p[1])) * 100)}%`;
        const tag = i === 3 ? '<span class="tagb">BEST VALUE</span>' : (i === 2 ? '<span class="tagb">POPULAR</span>' : '');
        return `
          <div class="pl" data-p="${i}" style="animation-delay:${0.12 + i * 0.08}s">
            ${tag}
            <div><b>${p[0]}</b><small>${sub}</small></div>
            <div class="pr">${rs(price)}</div>
          </div>
        `;
      }).join('')}
      <div class="lbl" style="margin-top:16px">START DATE</div>
      <div>
        ${days.map((d, i) => `
          <span class="chip ${i === 0 ? 'on' : ''}" data-d="${i}">
            ${i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }))}
          </span>
        `).join('')}
      </div>
      <p class="hint">The gym owner reviews your pass request first and shares available slots. You pay only after choosing your slot.</p>
      <button class="cta2" id="btn-send-req" disabled>SELECT A PASS</button>
    `;

    openSheet(sheetHtml);
    const sendBtn = document.getElementById('btn-send-req');

    sheet.querySelectorAll('.pl').forEach(row => {
      row.onclick = () => {
        sheet.querySelectorAll('.pl').forEach(r => r.classList.remove('on'));
        row.classList.add('on');
        selPlan = +row.getAttribute('data-p');
        sendBtn.disabled = false;
        sendBtn.textContent = `SEND REQUEST · ${rs((gym.dayPrice || 150) * PLANS[selPlan][2])}`;
        SoundFX.tick();
      };
    });

    sheet.querySelectorAll('[data-d]').forEach(chip => {
      chip.onclick = () => {
        sheet.querySelectorAll('[data-d]').forEach(c => c.classList.remove('on'));
        chip.classList.add('on');
        selDay = +chip.getAttribute('data-d');
        SoundFX.tick();
      };
    });

    sendBtn.onclick = async () => {
      if (selPlan < 0) return;
      sendBtn.disabled = true;
      sendBtn.textContent = 'SENDING REQUEST...';

      try {
        const res = await API.bookings.request({
          gymId: gym.id,
          planIndex: selPlan,
          startDate: days[selDay].toISOString(),
          userId: currentUser.id,
          userName: currentUser.name
        });
        currentBooking = res.booking;
      } catch(e) {
        currentBooking = {
          id: 'GG-' + Math.floor(10000 + Math.random() * 90000),
          userId: currentUser.id,
          userName: currentUser.name,
          gymId: gym.id,
          gymName: gym.name,
          city: curCity,
          area: curArea,
          planName: PLANS[selPlan][0],
          daysCount: PLANS[selPlan][1],
          startDate: days[selDay].toISOString().split('T')[0],
          endDate: new Date(days[selDay].getTime() + (PLANS[selPlan][1]-1)*86400000).toISOString().split('T')[0],
          amount: (gym.dayPrice || 150) * PLANS[selPlan][2],
          status: 'pending',
          availableSlots: ['5–7 AM', '7–9 AM', '5–7 PM', '7–9 PM'],
          paymentMethod: 'UPI'
        };
      }

      updatePill();
      renderBookingStatus();
      say(`Request sent to ${gym.name}!`);
      SoundFX.success();
    };
  }

  function updatePill() {
    if (!currentBooking) {
      reqpill.className = '';
      document.body.classList.remove('hasReq');
      return;
    }
    const map = {
      pending: ['⏳', `Waiting for ${currentBooking.gymName}`],
      accepted: ['✅', 'Accepted · slots coming'],
      slots: ['🕒', 'Choose your slot'],
      paid: ['🎟️', `Pass active · ${currentBooking.gymName}`],
      declined: ['⚠️', 'Request declined']
    };
    const m = map[currentBooking.status] || map.pending;
    reqpill.innerHTML = `${m[0]} <b>${m[1]}</b>`;
    reqpill.className = 'on' + (currentBooking.status === 'slots' ? ' pulse' : '');
    document.body.classList.add('hasReq');
  }
  reqpill.onclick = () => renderBookingStatus();

  async function syncBookings() {
    try {
      const res = await API.bookings.list();
      if (res.bookings && res.bookings.length) {
        currentBooking = res.bookings[0];
        updatePill();
      }
    } catch(e) {}
  }

  function renderBookingStatus() {
    if (!currentBooking) return;
    const b = currentBooking;
    const curIdx = { pending: 1, accepted: 2, slots: 3, paid: 5, declined: 1 }[b.status] || 1;

    let h = `
      <div class="grab"></div>
      <h4>${b.gymName}</h4>
      <p>${b.planName} pass · ${fmt(b.startDate)} to ${fmt(b.endDate)} · ${rs(b.amount)}</p>
    `;

    if (b.status === 'declined') {
      h += `
        <div class="ok">
          <div class="tick x">!</div>
          <h4>Request declined</h4>
          <p>${b.gymName} cannot host you on these dates. Try another gym nearby.</p>
        </div>
        <button class="cta2" id="btn-find-other">FIND ANOTHER GYM</button>
      `;
    } else {
      const steps = ['Request sent', 'Owner accepts', 'Slots shared', 'Choose slot & pay', 'Pass ready'];
      h += `
        <div class="tl">
          ${steps.map((st, i) => `
            <div class="st ${i < curIdx ? 'dn' : (i === curIdx ? 'cu' : '')}">
              <span>${i < curIdx ? '✓' : (i + 1)}</span>${st}
            </div>
          `).join('')}
        </div>
      `;

      if (b.status === 'pending') {
        h += `
          <div class="msg">
            <i class="sp"></i>Waiting for ${b.gymName} to accept your request. You are not charged yet.
          </div>
          <button class="cta2 ghost" id="btn-open-owner-demo">OPEN GYM OWNER APP (DEMO)</button>
        `;
      } else if (b.status === 'accepted') {
        h += `
          <div class="msg">
            <i class="sp"></i>Accepted! ${b.gymName} is selecting slots for your dates.
          </div>
          <button class="cta2 ghost" id="btn-open-owner-demo">OPEN GYM OWNER APP (DEMO)</button>
        `;
      } else if (b.status === 'slots' && !b._paying) {
        const slots = b.availableSlots && b.availableSlots.length ? b.availableSlots : ['5–7 AM', '7–9 AM', '5–7 PM', '7–9 PM'];
        h += `
          <div class="lbl">AVAILABLE SLOTS · DAILY</div>
          ${slots.map((s, i) => `
            <div class="pl ${b.slot === s ? 'on' : ''}" data-slot="${s}">
              <div><b>${s}</b><small>Verified daily slot</small></div>
              <div class="pr">${b.slot === s ? '✓' : ''}</div>
            </div>
          `).join('')}
          <button class="cta2" id="btn-to-pay" ${!b.slot ? 'disabled' : ''}>
            ${!b.slot ? 'CHOOSE A SLOT' : 'CONTINUE TO PAYMENT'}
          </button>
        `;
      } else if (b.status === 'slots' && b._paying) {
        h += `
          <div class="lbl">PAYMENT METHOD</div>
          <div class="sumr">
            <span>${b.planName} · ${b.slot}</span>
            <b>${rs(b.amount)}</b>
          </div>
          ${['UPI', 'Card', 'Net Banking'].map(m => `
            <div class="pl ${b.paymentMethod === m ? 'on' : ''}" data-method="${m}">
              <div><b>${m}</b></div>
              <div class="pr">${b.paymentMethod === m ? '●' : '○'}</div>
            </div>
          `).join('')}
          <button class="cta2" id="btn-do-pay">PAY ${rs(b.amount)} &amp; JOIN</button>
        `;
      } else if (b.status === 'paid') {
        h += `
          <div class="ok">
            <div class="tick">✓</div>
            <h4>You are in!</h4>
            <p>Payment received. Show this pass at the front desk.</p>
            <div class="pass">
              <div class="qr">${qrSvg(b.id)}</div>
              <div>
                <b>GYMGO PASS</b>
                <small>${b.gymName} · ${b.area || b.city}</small>
                <small>${fmt(b.startDate)} - ${fmt(b.endDate)} · ${b.slot || 'Daily'}</small>
                <small>PASS ID: ${b.id}</small>
              </div>
            </div>
            <button class="cta2" id="btn-pass-done">VIEW IN MY PASSES</button>
          </div>
        `;
      }
    }

    openSheet(h);

    if (document.getElementById('btn-open-owner-demo')) {
      document.getElementById('btn-open-owner-demo').onclick = () => {
        closeSheet();
        showScene('owner');
      };
    }

    if (document.getElementById('btn-find-other')) {
      document.getElementById('btn-find-other').onclick = () => {
        currentBooking = null;
        updatePill();
        closeSheet();
      };
    }

    if (document.getElementById('btn-pass-done')) {
      document.getElementById('btn-pass-done').onclick = () => {
        closeSheet();
        showScene('passes');
      };
    }

    sheet.querySelectorAll('[data-slot]').forEach(r => {
      r.onclick = () => {
        const s = r.getAttribute('data-slot');
        b.slot = s;
        sheet.querySelectorAll('[data-slot]').forEach(x => {
          x.classList.remove('on');
          x.querySelector('.pr').textContent = '';
        });
        r.classList.add('on');
        r.querySelector('.pr').textContent = '✓';
        const pBtn = document.getElementById('btn-to-pay');
        if (pBtn) {
          pBtn.disabled = false;
          pBtn.textContent = 'CONTINUE TO PAYMENT';
        }
        SoundFX.tick();
      };
    });

    if (document.getElementById('btn-to-pay')) {
      document.getElementById('btn-to-pay').onclick = () => {
        if (!b.slot) return;
        b._paying = true;
        renderBookingStatus();
        SoundFX.tick();
      };
    }

    sheet.querySelectorAll('[data-method]').forEach(r => {
      r.onclick = () => {
        b.paymentMethod = r.getAttribute('data-method');
        sheet.querySelectorAll('[data-method]').forEach(x => {
          x.classList.remove('on');
          x.querySelector('.pr').textContent = '○';
        });
        r.classList.add('on');
        r.querySelector('.pr').textContent = '●';
        SoundFX.tick();
      };
    });

    if (document.getElementById('btn-do-pay')) {
      document.getElementById('btn-do-pay').onclick = async () => {
        const pBtn = document.getElementById('btn-do-pay');
        pBtn.disabled = true;
        pBtn.textContent = 'PROCESSING UPI PAYMENT...';
        SoundFX.tick();

        try {
          const res = await API.bookings.chooseSlot(b.id, b.slot, b.paymentMethod);
          currentBooking = res.booking;
        } catch(e) {
          b.status = 'paid';
          b._paying = false;
        }

        setTimeout(() => {
          b.status = 'paid';
          b._paying = false;
          updatePill();
          renderBookingStatus();
          SoundFX.success();
          say('Payment complete! Pass generated & Passport stamped 🎉');
        }, 1200);
      };
    }
  }

  // ------------------------------------------------------------------------
  // Gym Owner Portal
  // ------------------------------------------------------------------------
  function initOwner() {
    renderOwner();
  }

  function renderOwner() {
    const b = currentBooking || {
      id: 'GG-Demo',
      userName: 'Alex Turner',
      gymName: 'Starts Gym',
      area: 'Tadepalli',
      planName: '1 Week',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 6 * 86400000).toISOString(),
      amount: 750,
      status: 'pending',
      slotsToggle: [1, 1, 1, 1, 1, 0]
    };

    const slotsMaster = [
      ['5–7 AM', 6],
      ['7–9 AM', 4],
      ['9–11 AM', 8],
      ['5–7 PM', 3],
      ['7–9 PM', 5],
      ['9–11 PM', 9]
    ];

    if (!b.slotsToggle) b.slotsToggle = [1, 1, 1, 1, 1, 0];

    let h = `
      <div class="wrap">
        <div class="oh">
          <button class="back" id="btn-owner-back">←</button>
          <div>
            <b>GYMGO for Gyms</b>
            <small>${b.gymName || 'Starts Gym'} · ${b.area || 'Tadepalli'}</small>
          </div>
        </div>
        <span class="obadge">GYM OWNER VIEW · REAL-TIME</span>

        <div class="lbl">${b.status === 'pending' ? 'NEW INCOMING REQUEST' : 'BOOKING REQUEST'}</div>
        <div class="rq">
          <div class="rqh">
            <div class="av">${(b.userName || 'A').charAt(0)}</div>
            <div>
              <b>${b.userName || 'Alex Turner'}</b>
              <small>Traveling Athlete · 🔥 47-day streak</small>
            </div>
          </div>
          <div class="rw"><span>Pass</span><b>${b.planName || '1 Week'}</b></div>
          <div class="rw"><span>Dates</span><b>${fmt(b.startDate)} - ${fmt(b.endDate)}</b></div>
          <div class="rw"><span>Goal</span><b>Strength &amp; Conditioning</b></div>
          <div class="rw"><span>Amount to receive</span><b>${rs(b.amount || 750)}</b></div>
          ${b.status === 'pending' ? `
            <div class="two">
              <button class="cta2 ghost" id="btn-owner-dec">DECLINE</button>
              <button class="cta2" id="btn-owner-acc">ACCEPT REQUEST</button>
            </div>
          ` : ''}
        </div>
    `;

    if (b.status === 'declined') {
      h += `<div class="msg">You declined this request. The athlete has been notified.</div>`;
    }

    if (b.status === 'accepted') {
      h += `
        <div class="lbl">SELECT SLOTS AVAILABLE FOR THESE DATES</div>
        ${slotsMaster.map((s, i) => {
          const on = b.slotsToggle[i];
          return `
            <div class="pl ${on ? 'on' : ''}" data-t="${i}">
              <div><b>${s[0]}</b><small>${s[1]} spots left</small></div>
              <div class="pr">${on ? 'Open' : 'Off'}</div>
            </div>
          `;
        }).join('')}
        <button class="cta2" id="btn-owner-share">SHARE SLOTS WITH ${b.userName.toUpperCase()}</button>
      `;
    }

    if (b.status === 'slots' || b.status === 'paid') {
      h += `<div class="msg">✅ Slots shared with ${b.userName}.</div>`;
      if (b.status === 'paid') {
        h += `
          <div class="msg" style="border-color:var(--accent);">
            💰 Payment verified! <b>${rs(b.amount)}</b> received. Slot: <b>${b.slot || '5-7 PM'}</b>
          </div>
        `;
      }
    }

    h += `
      <button class="cta2 ghost" id="btn-back-to-user" style="margin-top:22px">
        ← BACK TO ATHLETE APP
      </button>
    </div>`;

    owner.innerHTML = h;

    document.getElementById('btn-owner-back').onclick = () => showScene('home');
    document.getElementById('btn-back-to-user').onclick = () => {
      showScene('home');
      if (currentBooking) {
        renderBookingStatus();
      }
    };

    if (document.getElementById('btn-owner-acc')) {
      document.getElementById('btn-owner-acc').onclick = async () => {
        b.status = 'accepted';
        try { await API.bookings.ownerAction(b.id, 'accept'); } catch(e) {}
        renderOwner();
        say('Request accepted! Now pick available slots.');
        SoundFX.tick();
      };
    }

    if (document.getElementById('btn-owner-dec')) {
      document.getElementById('btn-owner-dec').onclick = async () => {
        b.status = 'declined';
        try { await API.bookings.ownerAction(b.id, 'decline'); } catch(e) {}
        renderOwner();
        say('Request declined.');
        SoundFX.tick();
      };
    }

    owner.querySelectorAll('[data-t]').forEach(r => {
      r.onclick = () => {
        const i = +r.getAttribute('data-t');
        b.slotsToggle[i] = b.slotsToggle[i] ? 0 : 1;
        r.classList.toggle('on', !!b.slotsToggle[i]);
        r.querySelector('.pr').textContent = b.slotsToggle[i] ? 'Open' : 'Off';
        SoundFX.tick();
      };
    });

    if (document.getElementById('btn-owner-share')) {
      document.getElementById('btn-owner-share').onclick = async () => {
        const chosen = slotsMaster.filter((s, i) => b.slotsToggle[i]).map(s => s[0]);
        if (!chosen.length) {
          say('Please leave at least 1 slot open');
          return;
        }
        b.availableSlots = chosen;
        b.status = 'slots';
        try { await API.bookings.ownerAction(b.id, 'share-slots', chosen); } catch(e) {}
        renderOwner();
        say(`Slots shared with ${b.userName}!`);
        SoundFX.success();
      };
    }
  }

  // ------------------------------------------------------------------------
  // AI Coach Controller
  // ------------------------------------------------------------------------
  const coachState = {
    sex: 'Male',
    goal: 'muscle',
    ap: 'bb',
    diet: 'non',
    med: ['None'],
    note: ''
  };

  const MED_LIST = ['None', 'Diabetes', 'High BP', 'Heart condition', 'Asthma', 'Back / joint pain', 'Thyroid', 'Other'];

  const FOOD_PLANS = {
    veg: {
      b: ['Moong dal chilla ×3 + mint chutney + high-protein milk', 'Idli ×3 + sambar + roasted chana chutney', 'Veg oats upma with sprouts'],
      s: ['Sprouts chaat with lemon & cucumber', 'Roasted makhana + walnuts', 'Chilled spiced buttermilk + almonds'],
      l: ['Roti ×2 + thick dal + paneer curry + salad', 'Brown rice (1 cup) + sambar + curd + beans poriyal', 'Chole with cucumber tomato salad'],
      p: ['Banana + peanut butter toast', 'Plant protein shake + apple', 'Boiled chickpeas with chaat masala'],
      d: ['Roti ×2 + mixed vegetable curry + Greek curd', 'Tofu & broccoli stir-fry in olive oil', 'Yellow lentil soup + 1 multigrain roti']
    },
    egg: {
      b: ['Whole egg omelette (3 eggs) + 2 multigrain toast', 'Idli ×3 + sambar + 2 boiled eggs', 'Moong dal chilla ×3 + 1 egg'],
      s: ['Boiled eggs ×2 + black pepper', 'Sprouts chaat', 'Buttermilk + handful of almonds'],
      l: ['Steamed rice (1 cup) + dal + homestyle egg curry + salad', 'Roti ×2 + paneer curry + 1 boiled egg', 'Veg pulao + cucumber raita + 2 boiled eggs'],
      p: ['Banana + boiled egg whites ×3', 'Whey protein shake + fruit', 'Roasted chana + apple'],
      d: ['Roti ×2 + egg bhurji + sautéed veggies', 'Lentil soup + 2 boiled eggs + green salad', 'Paneer stir-fry + 1 egg']
    },
    non: {
      b: ['Egg omelette (3 eggs) + 2 toast + fruit', 'Idli ×3 + chicken bone broth or curry', 'High-protein oats + eggs on the side'],
      s: ['Boiled eggs ×2', 'Roasted chana + walnuts', 'Chilled buttermilk + nuts'],
      l: ['Steamed rice + lean chicken curry + veggie bowl', 'Roti ×2 + grilled fish curry + cucumber salad', 'Lean chicken biryani bowl (small) + mint raita'],
      p: ['Boiled eggs ×2 + banana', 'Whole wheat grilled chicken sandwich', 'Whey protein shake + fruit'],
      d: ['Grilled chicken breast or tandoori fish + sautéed veggies', 'Egg curry + 2 rotis + high-fiber salad', 'Chicken clear soup + garden salad']
    }
  };

  const WORKOUT_SPLITS = {
    reg: [
      ['Full body A', [['Goblet squat', '3×12'], ['Incline push-up', '3×10'], ['Seated cable row', '3×12'], ['Plank', '3×30s']]],
      ['Brisk walk + core', [['Brisk walk', '3 km'], ['Dead bug', '3×10'], ['Side plank', '2×25s']]],
      ['Full body B', [['Leg press', '3×12'], ['Lat pulldown', '3×12'], ['DB bench press', '3×10'], ['Glute bridge', '3×12']]],
      ['Mobility & yoga', [['Full body mobility flow', '20 min'], ['Gentle walk', '15 min']]],
      ['Full body C', [['Goblet squat', '3×10'], ['Seated row', '3×12'], ['DB shoulder press', '2×12'], ['Cable crunch', '3×12']]],
      ['Active cardio', [['Cycling or swimming', '35 min']]],
      ['Full recovery', [['Deep sleep & hydration', '7-8 hrs']]]
    ],
    bb: [
      ['Push (Chest & Triceps)', [['Barbell bench press', '4×8'], ['Incline DB press', '3×10'], ['Lateral raise', '3×15'], ['Triceps rope pushdown', '3×12']]],
      ['Pull (Back & Biceps)', [['Lat pulldown', '4×10'], ['Barbell row', '3×10'], ['Face pull', '3×15'], ['Hammer curl', '3×12']]],
      ['Legs & Abs', [['Back squat / Leg press', '4×8'], ['Romanian deadlift', '3×10'], ['Leg curl', '3×12'], ['Hanging knee raise', '3×12']]],
      ['Push Hypertrophy', [['Incline bench press', '4×8'], ['Dumbbell bench press', '3×10'], ['Arnold press', '3×10'], ['Overhead triceps extension', '3×12']]],
      ['Pull Thickness', [['Seated cable row', '4×10'], ['One-arm DB row', '3×12'], ['Rear delt fly', '3×15'], ['Incline DB curl', '3×12']]],
      ['Legs & Calves', [['Leg press', '4×12'], ['Bulgarian split squat', '3×10/leg'], ['Standing calf raise', '4×15'], ['Cable crunch', '3×15']]],
      ['Rest & Walk', [['Light walk + recovery', '30 min']]]
    ],
    comp: [
      ['Chest & Triceps', [['Flat bench press', '5×5'], ['Incline DB press', '4×8'], ['Cable fly', '3×12'], ['Dips', '3×10'], ['Skull crushers', '3×12']]],
      ['Back & Biceps', [['Deadlift', '4×5'], ['Pull-up', '4×8'], ['Barbell row', '4×8'], ['Face pull', '4×15'], ['Preacher curl', '3×12']]],
      ['Legs & Core', [['Back squat', '5×5'], ['Romanian deadlift', '4×8'], ['Bulgarian split squat', '3×10'], ['Hanging leg raise', '4×12']]],
      ['Shoulders & Traps', [['Overhead barbell press', '4×8'], ['Lateral raise', '4×15'], ['Rear delt fly', '4×15'], ['Dumbbell shrugs', '4×12']]],
      ['Arms & Posing', [['Close grip bench press', '3×10'], ['Hammer curl', '3×12'], ['Triceps rope pushdown', '3×12'], ['Mandatory posing practice', '20 min']]],
      ['Zone-2 Conditioning', [['Incline treadmill walk', '45 min'], ['Core circuit', '3 rounds']]],
      ['Rest & Refeed', [['Active rest & hydration', '—']]]
    ]
  };

  function initCoach() {
    document.getElementById('cback').onclick = () => showScene('home');
    drawCoachMeds();

    // Check if user has an existing saved assessment
    API.coach.getAssessment().then(res => {
      if (res.assessment) {
        document.getElementById('c-age').value = res.assessment.age || 25;
        document.getElementById('c-h').value = res.assessment.h || 175;
        document.getElementById('c-w').value = res.assessment.w || 72;
        if (res.assessment.sex) coachState.sex = res.assessment.sex;
        if (res.assessment.goal) coachState.goal = res.assessment.goal;
        if (res.assessment.ap) coachState.ap = res.assessment.ap;
        if (res.assessment.diet) coachState.diet = res.assessment.diet;
        if (res.assessment.med) coachState.med = res.assessment.med;
        if (res.assessment.note) document.getElementById('c-note').value = res.assessment.note;
        updateCoachChips();
      }
    }).catch(() => {});
  }

  function drawCoachMeds() {
    const medBox = document.getElementById('med');
    if (!medBox) return;
    medBox.innerHTML = MED_LIST.map(m => `
      <span class="chip ${coachState.med.includes(m) ? 'on' : ''}" data-g="med" data-v="${m}">${m}</span>
    `).join('');
  }

  function updateCoachChips() {
    drawCoachMeds();
    ['sex', 'goal', 'diet'].forEach(group => {
      coach.querySelectorAll(`[data-g="${group}"]`).forEach(c => {
        c.classList.toggle('on', c.getAttribute('data-v') === coachState[group]);
      });
    });
    coach.querySelectorAll('.opt[data-g="ap"]').forEach(o => {
      o.classList.toggle('on', o.getAttribute('data-v') === coachState.ap);
    });
  }

  coach.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-g]');
    if (!t) return;

    const g = t.getAttribute('data-g');
    const v = t.getAttribute('data-v');

    if (g === 'med') {
      if (v === 'None') {
        coachState.med = ['None'];
      } else {
        coachState.med = coachState.med.filter(x => x !== 'None');
        const idx = coachState.med.indexOf(v);
        if (idx > -1) coachState.med.splice(idx, 1);
        else coachState.med.push(v);
        if (!coachState.med.length) coachState.med = ['None'];
      }
      drawCoachMeds();
      SoundFX.tick();
      return;
    }

    coachState[g] = v;
    coach.querySelectorAll(`[data-g="${g}"]`).forEach(x => {
      x.classList.toggle('on', x === t);
    });
    SoundFX.tick();
  });

  document.getElementById('cgo').onclick = () => {
    const age = +document.getElementById('c-age').value;
    const h = +document.getElementById('c-h').value;
    const w = +document.getElementById('c-w').value;
    const note = document.getElementById('c-note').value.trim();

    if (!(age >= 12 && age <= 90)) { say('Please enter a valid age (12–90)'); return; }
    if (!(h >= 120 && h <= 220)) { say('Please enter height between 120 and 220 cm'); return; }
    if (!(w >= 30 && w <= 200)) { say('Please enter weight between 30 and 200 kg'); return; }
    if (!coachState.sex || !coachState.goal || !coachState.ap || !coachState.diet) {
      say('Please pick sex, goal, approach, and food preference');
      return;
    }

    const assessment = {
      age, h, w, note,
      sex: coachState.sex,
      goal: coachState.goal,
      ap: coachState.ap,
      diet: coachState.diet,
      med: coachState.med.slice()
    };

    // Save to backend
    API.coach.saveAssessment(assessment).catch(() => {});

    document.getElementById('cform').style.display = 'none';
    const think = document.getElementById('think');
    const thinkText = document.getElementById('thinkt');
    const cres = document.getElementById('cres');
    cres.innerHTML = '';

    const messages = [
      'Calculating BMR, TDEE, and optimal calorie targets...',
      'Setting heart-rate zones & hydration requirements...',
      'Cross-referencing medical notes & safety considerations...',
      'Generating tailored 7-day split & Indian nutrition plan...'
    ];
    let k = 0;
    think.className = 'think show';
    thinkText.textContent = messages[0];
    const iv = setInterval(() => {
      k++;
      if (k < messages.length) thinkText.textContent = messages[k];
    }, 600);

    setTimeout(() => {
      clearInterval(iv);
      think.className = 'think';
      cres.innerHTML = renderCoachOutput(assessment);
      cres.className = 'play';
      coach.scrollTop = 0;
      wireCoachOutput(assessment);
      SoundFX.success();
    }, 2500);
  };

  function renderCoachOutput(data) {
    const hm = data.h / 100;
    const bmi = +(data.w / (hm * hm)).toFixed(1);
    const male = data.sex === 'Male';
    const bmr = Math.round(10 * data.w + 6.25 * data.h - 5 * data.age + (male ? 5 : -161));
    const tdeeMult = { reg: 1.4, bb: 1.55, comp: 1.7 }[data.ap] || 1.4;
    const tdee = Math.round(bmr * tdeeMult);

    const goalAdj = data.goal === 'fat' ? -450 : (data.goal === 'muscle' ? 350 : 0);
    const kcal = Math.max(male ? 1500 : 1200, Math.round((tdee + goalAdj) / 10) * 10);

    const proteinMult = { reg: 1.4, bb: 2.0, comp: 2.2 }[data.ap] || 1.5;
    const protein = Math.round(data.w * proteinMult);
    const fat = Math.round((kcal * 0.25) / 9);
    const carbs = Math.max(100, Math.round((kcal - protein * 4 - fat * 9) / 4));

    const maxHr = Math.round(208 - 0.7 * data.age);
    const hrZone = `${Math.round(maxHr * 0.6)}–${Math.round(maxHr * 0.75)} bpm`;
    const waterLiters = +(Math.min(4.5, (data.w * 35 + 500) / 1000)).toFixed(1);
    const waterGlasses = Math.round(waterLiters * 4);

    const bmiCat = bmi < 18.5 ? ['Underweight', '#5aa9ff'] :
                   bmi < 25 ? ['Healthy Weight', '#c6ff3d'] :
                   bmi < 30 ? ['Overweight', '#ffc83d'] : ['Obese', '#ff6b6b'];

    const dow = (new Date().getDay() + 6) % 7;
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const currentSplit = WORKOUT_SPLITS[data.ap] || WORKOUT_SPLITS.reg;
    const todaysWorkout = currentSplit[dow];

    const mealTemplates = [
      ['Breakfast', 'b', 0.25],
      ['Mid-Morning Snack', 's', 0.10],
      ['Lunch', 'l', 0.30],
      ['Pre / Post Workout', 'p', 0.12],
      ['Dinner', 'd', 0.23]
    ];
    const foodDiet = FOOD_PLANS[data.diet] || FOOD_PLANS.non;

    return `
      <div class="bub a" style="--d:.05s">
        <div class="av">AI</div>
        <div>
          Hi <b>${currentUser.name || 'Athlete'}</b>! Your <b>${{ reg: 'Regular Fitness', bb: 'Bodybuilding & Hypertrophy', comp: 'Contest Prep' }[data.ap]}</b> protocol is ready. Calculated for your biometrics, target goals, and nutrition preference.
        </div>
      </div>

      <div class="sm a" style="--d:.2s">
        <div class="ringw">
          <svg viewBox="0 0 100 100">
            <circle class="rb" cx="50" cy="50" r="40"/>
            <circle class="rg" cx="50" cy="50" r="40" stroke="${bmiCat[1]}" stroke-dasharray="${Math.min(1, Math.max(0.05, (bmi-15)/25)) * 251.3} 252"/>
          </svg>
          <div class="rt">
            <div><span>${bmi}</span><small>BMI</small></div>
          </div>
        </div>
        <div class="tt">
          <b style="color:${bmiCat[1]}">${bmiCat[0]}</b><br>
          ${data.h} cm · ${data.w} kg · ${data.age} yrs<br>
          Goal: <b>${{ fat: 'Fat Loss', muscle: 'Muscle Hypertrophy', fit: 'Endurance & Fitness' }[data.goal]}</b>
        </div>
      </div>

      <div class="sec a" style="--d:.35s">DAILY BIOMETRIC TARGETS</div>
      <div class="gl">
        <div class="gt2 a" style="--d:.4s"><small>Daily Calories</small><b>${kcal}</b><em>kcal target</em></div>
        <div class="gt2 a" style="--d:.45s"><small>Protein Target</small><b>${protein}g</b><em>${proteinMult}g / kg weight</em></div>
        <div class="gt2 a" style="--d:.5s"><small>Cardio HR Zone</small><b>${hrZone}</b><em>target aerobic zone</em></div>
        <div class="gt2 a" style="--d:.55s"><small>Daily Hydration</small><b>${waterLiters}L</b><em>${waterGlasses} glasses / day</em></div>
        <div class="gt2 big a" style="--d:.6s">
          <small>Water Tracker · Tap to log glasses</small>
          <div class="wat" id="wat-glasses">
            ${Array(waterGlasses).fill('<i></i>').join('')}
          </div>
        </div>
      </div>

      <div class="sec a" style="--d:.7s">TODAY · ${dayNames[dow].toUpperCase()} · ${todaysWorkout[0].toUpperCase()}</div>
      <div class="pbar a" style="--d:.75s"><i id="pb-coach"></i></div>
      <div id="ex-coach">
        ${todaysWorkout[1].map((ex, idx) => `
          <div class="ck a" style="--d:${0.8 + idx * 0.06}s">
            <u>✓</u><b>${ex[0]}</b><small>${ex[1]}</small>
          </div>
        `).join('')}
      </div>

      <div class="sec a" style="--d:1.1s">7-DAY SPLIT CALENDAR</div>
      ${currentSplit.map((d, idx) => `
        <div class="wk ${idx === dow ? 'td' : ''} a" style="--d:${1.15 + idx * 0.04}s">
          <b>${dayNames[idx]}</b>
          <span>${d[0]}</span>
        </div>
      `).join('')}

      <div class="sec a" style="--d:1.4s">MACRONUTRIENT BREAKDOWN</div>
      <div class="mac a" style="--d:1.45s">
        <div><b>${kcal}</b>kcal</div>
        <div><b>${protein}g</b>protein</div>
        <div><b>${carbs}g</b>carbs</div>
        <div><b>${fat}g</b>fats</div>
      </div>

      <div class="sec a" style="--d:1.5s">INDIAN NUTRITION MEAL PLAN</div>
      ${mealTemplates.map((m, idx) => {
        const food = foodDiet[m[1]] || ['Healthy balanced food'];
        return `
          <div class="ml a" style="--d:${1.55 + idx * 0.06}s">
            <h5>${m[0]} <span>~${Math.round((kcal * m[2]) / 10) * 10} kcal · ${Math.round(protein * m[2])}g protein</span></h5>
            <p>• ${food[0]}</p>
            ${food[1] ? `<p>• or ${food[1]}</p>` : ''}
          </div>
        `;
      }).join('')}

      <div class="sec a" style="--d:1.8s">SAFETY &amp; HEALTH PROTOCOL</div>
      <div class="sf a" style="--d:1.85s">
        <b>Medical &amp; Form Advice:</b>
        <ul>
          ${data.med.includes('Diabetes') ? '<li><b>Diabetes:</b> Prefer millets, brown rice, whole lentils. Monitor glucose before &amp; after heavy lifting. Keep quick carbs handy.</li>' : ''}
          ${data.med.includes('High BP') ? '<li><b>High BP:</b> Avoid Valsalva maneuver (never hold breath under load). Exhale during exertion. Keep sodium regulated.</li>' : ''}
          ${data.med.includes('Heart condition') ? '<li><b>Heart Condition:</b> Keep cardio strictly to conversational Zone-1/2 pace. Clear all heavy training with your physician.</li>' : ''}
          ${data.med.includes('Back / joint pain') ? '<li><b>Joint / Back Care:</b> Use joint-friendly alternatives (Goblet squats over heavy spinal-loaded back squats). Focus on core bracing.</li>' : ''}
          ${data.med.includes('Asthma') ? '<li><b>Asthma:</b> Warm up for 10 full minutes to acclimate bronchial airways. Keep inhaler within reach.</li>' : ''}
          <li>Prioritize movement mechanics and controlled eccentrics (2 seconds down, explosive up).</li>
          <li>Ensure minimum 7–8 hours of uninterrupted sleep for neuromuscular recovery.</li>
        </ul>
      </div>

      <button class="ghostb a" style="--d:1.9s" id="cedit">↺ EDIT ASSESSMENT</button>
    `;
  }

  function wireCoachOutput(assessment) {
    const glasses = document.querySelectorAll('#wat-glasses i');
    glasses.forEach((g, idx) => {
      g.onclick = () => {
        const isFilled = g.classList.contains('f') && (!g.nextElementSibling || !g.nextElementSibling.classList.contains('f'));
        glasses.forEach((x, m) => {
          x.classList.toggle('f', isFilled ? m < idx : m <= idx);
        });
        const filledCount = document.querySelectorAll('#wat-glasses i.f').length;
        API.coach.updateWater(filledCount).catch(() => {});
        SoundFX.tick();
      };
    });

    const checks = document.querySelectorAll('#ex-coach .ck');
    checks.forEach(c => {
      c.onclick = () => {
        c.classList.toggle('on');
        const done = document.querySelectorAll('#ex-coach .ck.on').length;
        const pb = document.getElementById('pb-coach');
        if (pb) pb.style.width = `${Math.round((done / checks.length) * 100)}%`;
        if (done === checks.length) {
          SoundFX.success();
          say('Workout complete! 🔥 Great discipline.');
        } else {
          SoundFX.tick();
        }
      };
    });

    document.getElementById('cedit').onclick = () => {
      document.getElementById('cres').innerHTML = '';
      document.getElementById('cform').style.display = 'block';
      coach.scrollTop = 0;
    };
  }

  // ------------------------------------------------------------------------
  // Workout Sessions & Rest Timer Controller
  // ------------------------------------------------------------------------
  const LV = { b: 'Beginner', m: 'Moderate', a: 'Advanced' };
  const HUE_MAP = { Chest: 20, Back: 210, Legs: 130, Shoulders: 280, Arms: 340, Core: 50, Cardio: 180 };
  const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];

  const LIB_RAW = [
    'pushup|Push-up|Chest|b|Hands under shoulders, body straight;Lower chest to just above floor;Press back up firmly|Builds chest, anterior delts and triceps anywhere',
    'inclpush|Incline push-up|Chest|b|Hands on elevated bench or box;Lower chest with control;Press up keeping core tight|Reduces load to build baseline pressing strength',
    'dbpress|DB bench press|Chest|m|Lie flat with dumbbells at chest level;Press up until arms extend;Lower slowly for 2 seconds|Allows natural wrist rotation and greater range of motion',
    'bench|Barbell bench press|Chest|m|Feet flat, shoulder blades pinched into bench;Lower bar to mid-sternum;Drive up forcefully|The classic compound foundation for upper body pressing power',
    'inclbench|Incline barbell press|Chest|a|Bench angled at 30 degrees;Lower bar to clavicle;Drive up and slightly back|Targets the clavicular head (upper chest)',
    'fly|Cable fly|Chest|m|Slight elbow bend, bring handles together in hugging arc;Squeeze peak contraction;Control eccentric stretch|Constant tension throughout full chest contraction',
    'dips|Chest dips|Chest|a|Lean torso forward 15 degrees;Lower until shoulders reach elbow height;Press up|Massive builder for lower chest and triceps',
    'latpd|Lat pulldown|Back|b|Grip wide, chest tall;Pull bar to upper collarbone with elbows driving down;Resist weight on way up|Teaches scapular depression and builds lat width',
    'seatrow|Seated cable row|Back|b|Sit upright with knees soft;Pull handle into naval while retracting shoulder blades;Extend without rounding lower back|Fosters back thickness and healthy posture',
    'dbrow|One-arm DB row|Back|m|Support on bench;Pull dumbbell to hip pocket;Lower fully for deep lat stretch|Isolates each lat side to fix strength asymmetries',
    'pullup|Strict pull-up|Back|a|Pronated grip;Pull chin over bar without kipping;Lower with full control|Ultimate bodyweight pulling benchmark',
    'bbrow|Barbell bent-over row|Back|a|Hinge at hips, back flat at 45 degrees;Pull bar to lower sternum;Lower slowly|Heavy compound mass builder for entire upper back',
    'deadlift|Conventional deadlift|Back|a|Bar over mid-foot, hips back, lats engaged;Drive floor away with legs;Lock out hips and glutes|Full-body structural strength',
    'facepull|Face pull|Back|m|Rope at eye level;Pull towards nose, rotating knuckles back;Squeeze rear delts|Protects rotator cuffs and enhances posture',
    'gsquat|Goblet squat|Legs|b|Hold dumbbell vertically at sternum;Squat between hips, knees tracking over toes;Drive through whole foot to stand|Teaches flawless upright squat mechanics',
    'legpress|Leg press 45°|Legs|b|Feet shoulder-width on carriage;Lower until knees reach 90 degrees;Press up without locking knees|Heavy leg loading without spinal compression',
    'lunge|Walking lunges|Legs|m|Step forward, drop back knee to hover above ground;Drive off front heel into next step|Develops single-leg balance and glute power',
    'rdl|Romanian deadlift|Legs|m|Knees slightly soft;Push hips straight back while lowering weights along shins;Drive hips through to stand|Hamstring and glute hypertrophy foundation',
    'bsquat|Barbell back squat|Legs|a|Bar on upper traps;Squat below parallel with knees out;Ascend with chest proud|King of compound lower body movements',
    'bulg|Bulgarian split squat|Legs|a|Rear foot elevated on bench;Lower hips straight down;Drive up through front heel|Fixes imbalances and builds glutes/quads',
    'legcurl|Hamstring leg curl|Legs|m|Pad above heels;Curl smoothly toward glutes;Lower under control|Direct hamstring isolation',
    'calf|Standing calf raise|Legs|b|Balls of feet on ledge;Rise up onto big toes;Lower below level for full stretch|Calf endurance and ankle stability',
    'dbshoulder|Dumbbell shoulder press|Shoulders|b|Sit tall, dumbbells at ear level;Press vertically overhead;Lower smoothly|Overhead pressing stability',
    'lateral|DB lateral raise|Shoulders|b|Soft elbows;Raise dumbbells to shoulder height leading with elbows;Lower slowly|Widens lateral deltoids for V-taper aesthetic',
    'ohp|Barbell overhead press|Shoulders|a|Bar on front delts;Press straight up, moving head through window;Lock out overhead|Raw upper body vertical pushing power',
    'arnold|Arnold press|Shoulders|m|Start palms facing chest;Rotate outward as you press overhead;Reverse on descent|Engages all three shoulder heads smoothly',
    'curl|Dumbbell biceps curl|Arms|b|Elbows pinned to sides;Curl dumbbells with supination;Lower for 2 seconds|Biceps peak development',
    'hammer|Neutral hammer curl|Arms|b|Palms facing inward;Curl up with wrists rigid;Lower smoothly|Targets brachialis for arm thickness',
    'tripush|Triceps rope pushdown|Arms|b|Elbows locked at sides;Push rope down and flare outward at bottom;Return slowly|Triceps lateral and medial head isolation',
    'closegrip|Close-grip bench press|Arms|a|Grip shoulder-width, elbows tucked;Lower to lower chest;Press up focusing on triceps|Heavy triceps loading',
    'plank|Front elbow plank|Core|b|Elbows under shoulders, glutes clamped;Maintain rigid plank without sagging;Breathe steadily|Anterior core isometric endurance',
    'deadbug|Dead bug|Core|b|Lie on back, press spine flat to floor;Extend opposite arm and leg slowly;Return and alternate|Teaches anti-extension core control',
    'hangleg|Hanging leg raise|Core|a|Hang from bar with active shoulders;Raise straight legs to horizontal or bar;Lower without swinging|Lower abs and hip flexor strength'
  ];

  const EXERCISE_CATALOG = {};
  LIB_RAW.forEach(r => {
    const p = r.split('|');
    EXERCISE_CATALOG[p[0]] = {
      id: p[0],
      name: p[1],
      muscle: p[2],
      level: p[3],
      steps: p[4].split(';'),
      advantage: p[5]
    };
  });

  const DEFAULT_SPLITS = {
    b: [
      ['Full Body A', 'gsquat:3×12;inclpush:3×10;seatrow:3×12;dbshoulder:2×12;plank:3×30s'],
      ['Walk + Core', 'plank:3×45s;deadbug:3×10'],
      ['Full Body B', 'legpress:3×12;pushup:3×10;latpd:3×12;hammer:2×12'],
      ['Mobility Flow', 'plank:3×30s'],
      ['Full Body C', 'gsquat:3×10;dbpress:3×10;dbrow:3×10;lateral:2×15'],
      ['Cardio Day', 'plank:3×30s'],
      ['Rest & Recovery', '']
    ],
    m: [
      ['Upper Hypertrophy', 'dbpress:4×10;dbrow:4×10;dbshoulder:3×10;curl:3×12;tripush:3×12'],
      ['Lower Power', 'legpress:4×12;rdl:3×10;lunge:3×10;legcurl:3×12;calf:4×15'],
      ['Core & Conditioning', 'plank:4×45s;deadbug:3×12'],
      ['Upper Strength', 'bench:4×8;latpd:4×10;arnold:3×10;hammer:3×12'],
      ['Lower Volume', 'gsquat:4×10;rdl:3×10;legcurl:3×12;calf:4×15'],
      ['Abs & Calisthenics', 'pushup:4×12;hangleg:3×10'],
      ['Rest & Recovery', '']
    ],
    a: [
      ['Push Heavy', 'bench:5×5;inclbench:4×8;ohp:4×8;lateral:4×15;closegrip:3×10;dips:3×10'],
      ['Pull Heavy', 'deadlift:4×5;pullup:4×8;bbrow:4×8;facepull:3×15'],
      ['Legs Heavy', 'bsquat:5×5;rdl:4×8;bulg:3×10;legcurl:4×12;calf:5×15'],
      ['Push Volume', 'inclbench:4×8;dbpress:4×10;arnold:4×10;fly:3×12'],
      ['Pull Volume', 'bbrow:4×8;latpd:4×10;dbrow:3×10;hammer:3×12'],
      ['Legs & Core', 'legpress:4×12;lunge:3×12;hangleg:4×12'],
      ['Rest & Growth', '']
    ]
  };

  const workoutState = {
    level: 'm',
    day: (new Date().getDay() + 6) % 7,
    edits: {},
    done: {},
    custom: [],
    logs: [],
    draft: '',
    tomorrow: ''
  };

  let restTimerInterval = null;

  function initWorkout() {
    document.getElementById('woback').onclick = () => showScene('home');
    API.workouts.getState().then(res => {
      if (res.edits) workoutState.edits = res.edits;
      if (res.done) workoutState.done = res.done;
      if (res.custom) workoutState.custom = res.custom;
      renderWorkoutHead();
      renderWorkoutDay();
      renderWorkoutNotes();
    }).catch(() => {
      renderWorkoutHead();
      renderWorkoutDay();
      renderWorkoutNotes();
    });

    API.workouts.getLogs().then(res => {
      if (res.logs) workoutState.logs = res.logs;
      renderWorkoutLogs();
    }).catch(() => {});
  }

  function getWorkoutKey() {
    return `${workoutState.level}${workoutState.day}`;
  }

  function getDayItems() {
    const key = getWorkoutKey();
    if (workoutState.edits[key]) return workoutState.edits[key];
    const raw = DEFAULT_SPLITS[workoutState.level][workoutState.day][1];
    if (!raw) return [];
    return raw.split(';').map(x => {
      const parts = x.split(':');
      return { id: parts[0], sets: parts[1] || '3×10' };
    });
  }

  function setDayItems(items) {
    const key = getWorkoutKey();
    workoutState.edits[key] = items;
    API.workouts.saveState({ edits: workoutState.edits }).catch(() => {});
  }

  function getExercise(id) {
    return EXERCISE_CATALOG[id] ||
           workoutState.custom.find(c => c.id === id) ||
           { id, name: 'Exercise', muscle: 'Core', level: 'b', steps: ['Perform with control.'], advantage: 'Custom variation.' };
  }

  function parseSetsCount(s) {
    const m = /^(\d+)\s*×/.exec(s || '');
    return m ? +m[1] : 1;
  }

  function renderWorkoutHead() {
    const head = document.getElementById('wohead');
    const td = (new Date().getDay() + 6) % 7;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    head.innerHTML = `
      <div class="seg a" style="--d:.1s">
        ${['b', 'm', 'a'].map(k => `
          <span data-lv="${k}" class="${workoutState.level === k ? 'on' : ''}">${LV[k]}</span>
        `).join('')}
      </div>
      <div class="ldesc a" style="--d:.15s">
        ${workoutState.level === 'b' ? '3 days full-body structure. Master compound movement mechanics with 2–3 sets of 8–12 reps.' :
          workoutState.level === 'm' ? '4-day upper/lower split. Progressive overload with 3–4 working sets.' :
          'Push / Pull / Legs twice a week. Advanced volume, heavy compound loading & dropsets.'}
      </div>
      <div class="week a" style="--d:.2s">
        ${DEFAULT_SPLITS[workoutState.level].map((d, i) => `
          <div class="dp ${i === workoutState.day ? 'on' : ''} ${i === td ? 'td' : ''}" data-dy="${i}">
            <b>${days[i]}</b>
            <small>${d[0]}</small>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderWorkoutDay() {
    const dayBox = document.getElementById('woday');
    const items = getDayItems();
    const splitInfo = DEFAULT_SPLITS[workoutState.level][workoutState.day];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    let h = `
      <div class="dh">
        <h3>${days[workoutState.day]} · ${splitInfo[0]}</h3>
        <small>${items.length ? `${items.length} exercises programmed · tap card for biomechanics &amp; cues` : 'Scheduled recovery day. Focus on hydration, mobility and sleep.'}</small>
      </div>
    `;

    if (items.length) {
      h += `
        <div class="rest" id="rest-box">
          <span>⏱ Rest Timer</span>
          ${[30, 60, 90, 120].map(s => `
            <span class="chip" data-rest="${s}">${s < 120 ? s + 's' : '2 min'}</span>
          `).join('')}
          <div class="rt2">
            <i id="rest-bar"></i>
            <b id="rest-txt"></b>
          </div>
        </div>
      `;

      items.forEach((item, idx) => {
        const ex = getExercise(item.id);
        const key = `${getWorkoutKey()}:${idx}:${item.id}`;
        const doneSets = workoutState.done[key] || 0;
        const totalSets = parseSetsCount(item.sets);
        const hue = HUE_MAP[ex.muscle] || 200;

        let chips = '';
        for (let k = 0; k < totalSets; k++) {
          chips += `<i data-set="${k}" class="${k < doneSets ? 'f' : ''}">${totalSets > 1 || k > 0 ? `Set ${k+1}` : 'Done'}</i>`;
        }

        h += `
          <div class="xc" data-i="${idx}" style="animation-delay:${idx * 0.05}s">
            <div class="xh">
              <div class="xi" style="background:linear-gradient(135deg, hsl(${hue},70%,46%), hsl(${hue+40},60%,22%))">
                ${ex.photo ? `<img src="${ex.photo}" alt="">` : ex.muscle.slice(0, 2).toUpperCase()}
              </div>
              <div class="xt">
                <b>${esc(ex.name)}</b>
                <small>${ex.muscle}<span class="lv ${ex.level}">${LV[ex.level]}</span></small>
              </div>
              <div class="xs">${esc(item.sets || '')}</div>
            </div>
            <div class="sc">${chips}</div>
            <div class="xb">
              <h6>EXECUTION STEPS</h6>
              <ol>${ex.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
              <h6>TARGET BENEFIT</h6>
              <p>${esc(ex.advantage)}</p>
              ${ex.photo ? `<img class="xph" src="${ex.photo}" alt="">` : ''}
              <div class="xa">
                <input data-sets-input value="${esc(item.sets || '')}" aria-label="Sets and reps">
                <button data-act="swap">⇄ Swap variation</button>
                <button data-act="photo">📷 Photo</button>
                <button data-act="rm" class="dg">Remove</button>
              </div>
            </div>
          </div>
        `;
      });
    }

    h += `
      <button class="cta2 ghost" id="btn-add-ex" style="margin-top:8px">+ ADD EXERCISE OR VARIATION</button>
      ${workoutState.edits[getWorkoutKey()] ? `
        <button class="ghostb" id="btn-reset-day">↺ Reset day to default program</button>
      ` : ''}
    `;

    dayBox.innerHTML = h;
  }

  function renderWorkoutNotes() {
    const notesBox = document.getElementById('wnotes');
    const nx = DEFAULT_SPLITS[workoutState.level][((workoutState.day + 1) % 7)];
    notesBox.innerHTML = `
      <div class="sec">TRAINING LOGS &amp; NOTES</div>
      <div class="nb">
        <div class="lbl">LOG TODAY'S SESSION</div>
        <textarea class="ta" id="logt" placeholder="e.g. Bench: 60kg × 8, 8, 7. DB Row: 32kg × 10. Felt strong!">${esc(workoutState.draft || '')}</textarea>
        <button class="ghostb" id="btn-autofill-sets">Auto-fill from checked sets</button>
        <button class="cta2" id="btn-save-log" style="margin-top:10px">SAVE TO WORKOUT LOG</button>
      </div>
      <div class="nb">
        <div class="lbl">TOMORROW'S TARGET (PERSONAL NOTES)</div>
        <textarea class="ta" id="tmr" placeholder="Tomorrow's routine: ${esc(nx[0])}. Enter target weights or goals...">${esc(workoutState.tomorrow || '')}</textarea>
      </div>
      <div class="lbl">PERSONAL TRAINING HISTORY</div>
      <div id="hist-list"></div>
    `;
    renderWorkoutLogs();
  }

  function renderWorkoutLogs() {
    const list = document.getElementById('hist-list');
    if (!list) return;
    if (!workoutState.logs || !workoutState.logs.length) {
      list.innerHTML = `<div class="msg">No workout logs saved yet. Finish your sets and save your first log!</div>`;
      return;
    }

    list.innerHTML = workoutState.logs.slice().reverse().map(l => `
      <div class="hi">
        <small>
          <span>${new Date(l.t).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${esc(l.d)}</span>
          <a data-del-log="${l.t}">Delete</a>
        </small>
        ${esc(l.x)}
      </div>
    `).join('');
  }

  function startRestTimer(seconds) {
    clearInterval(restTimerInterval);
    const end = Date.now() + seconds * 1000;
    const box = document.getElementById('rest-box');
    const bar = document.getElementById('rest-bar');
    const txt = document.getElementById('rest-txt');
    if (!box) return;

    box.className = 'rest on';
    restTimerInterval = setInterval(() => {
      const left = Math.ceil((end - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(restTimerInterval);
        box.className = 'rest';
        SoundFX.timerDone();
        say('Rest interval complete! Time for the next set 💪');
        return;
      }
      txt.textContent = `${left}s`;
      bar.style.width = `${(left / seconds) * 100}%`;
    }, 200);
  }

  wo.addEventListener('click', (ev) => {
    const t = ev.target;
    const q = s => t.closest(s);

    if (q('[data-lv]')) {
      workoutState.level = q('[data-lv]').getAttribute('data-lv');
      renderWorkoutHead();
      renderWorkoutDay();
      renderWorkoutNotes();
      SoundFX.tick();
      return;
    }

    if (q('[data-dy]')) {
      workoutState.day = +q('[data-dy]').getAttribute('data-dy');
      renderWorkoutHead();
      renderWorkoutDay();
      SoundFX.tick();
      return;
    }

    if (q('[data-rest]')) {
      startRestTimer(+q('[data-rest]').getAttribute('data-rest'));
      SoundFX.tick();
      return;
    }

    if (q('.sc i')) {
      const chip = q('.sc i');
      const xc = q('.xc');
      const idx = +xc.getAttribute('data-i');
      const setIdx = +chip.getAttribute('data-set');
      const items = getDayItems();
      const key = `${getWorkoutKey()}:${idx}:${items[idx].id}`;
      const cur = workoutState.done[key] || 0;

      workoutState.done[key] = (cur === setIdx + 1) ? setIdx : setIdx + 1;
      API.workouts.saveState({ done: workoutState.done }).catch(() => {});

      xc.querySelectorAll('.sc i').forEach((c, m) => {
        c.classList.toggle('f', m < workoutState.done[key]);
      });

      SoundFX.tick();

      if (workoutState.done[key] > cur) {
        startRestTimer(60);
      }
      return;
    }

    if (q('[data-act]')) {
      const xc = q('.xc');
      const idx = +xc.getAttribute('data-i');
      const act = q('[data-act]').getAttribute('data-act');
      const items = getDayItems();

      if (act === 'swap') openSwapSheet(idx);
      if (act === 'rm') {
        const next = items.slice();
        next.splice(idx, 1);
        setDayItems(next);
        renderWorkoutDay();
      }
      if (act === 'photo') {
        wo.setAttribute('data-target-photo', items[idx].id);
        document.getElementById('pf').click();
      }
      return;
    }

    if (q('.xh') && !q('.xb')) {
      q('.xc').classList.toggle('open');
      SoundFX.tick();
      return;
    }

    if (q('#btn-add-ex')) {
      openAddExerciseSheet();
      return;
    }

    if (q('#btn-reset-day')) {
      delete workoutState.edits[getWorkoutKey()];
      API.workouts.saveState({ edits: workoutState.edits }).catch(() => {});
      renderWorkoutDay();
      say('Reset to default plan');
      return;
    }

    if (q('#btn-autofill-sets')) {
      const items = getDayItems();
      const lines = items.map((e, m) => {
        const key = `${getWorkoutKey()}:${m}:${e.id}`;
        const done = workoutState.done[key] || 0;
        return done ? `${getExercise(e.id).name}: ${done}/${parseSetsCount(e.sets)} sets (${e.sets})` : '';
      }).filter(Boolean).join('\n');

      const logInput = document.getElementById('logt');
      logInput.value = lines || 'No sets checked yet today.';
      workoutState.draft = logInput.value;
      SoundFX.tick();
      return;
    }

    if (q('#btn-save-log')) {
      const text = document.getElementById('logt').value.trim();
      if (!text) { say('Enter training notes first'); return; }

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const newLog = {
        t: Date.now(),
        d: `${LV[workoutState.level]} · ${days[workoutState.day]}`,
        x: text
      };

      workoutState.logs.push(newLog);
      API.workouts.saveLog(newLog).catch(() => {});
      document.getElementById('logt').value = '';
      workoutState.draft = '';
      renderWorkoutLogs();
      SoundFX.success();
      say('Workout logged to history! 📝');
      return;
    }

    if (q('[data-del-log]')) {
      const ts = +q('[data-del-log]').getAttribute('data-del-log');
      workoutState.logs = workoutState.logs.filter(l => l.t !== ts);
      API.workouts.deleteLog(ts).catch(() => {});
      renderWorkoutLogs();
      SoundFX.tick();
      return;
    }
  });

  wo.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.id === 'logt') workoutState.draft = t.value;
    if (t.id === 'tmr') workoutState.tomorrow = t.value;
    if (t.hasAttribute('data-sets-input')) {
      const xc = t.closest('.xc');
      const idx = +xc.getAttribute('data-i');
      const items = getDayItems().slice();
      items[idx].sets = t.value;
      setDayItems(items);
      xc.querySelector('.xs').textContent = t.value;
    }
  });

  // Handle custom exercise photos
  document.getElementById('pf').onchange = function() {
    const file = this.files[0];
    const targetId = wo.getAttribute('data-target-photo');
    if (!file || !targetId) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 640 / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        const customMatch = workoutState.custom.find(c => c.id === targetId);
        if (customMatch) customMatch.photo = dataUrl;
        else if (EXERCISE_CATALOG[targetId]) EXERCISE_CATALOG[targetId].photo = dataUrl;

        API.workouts.saveState({ custom: workoutState.custom }).catch(() => {});
        renderWorkoutDay();
        say('Photo attached to exercise!');
        SoundFX.success();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    this.value = '';
  };

  let muscleFilter = 'All';

  function openAddExerciseSheet() {
    const all = Object.values(EXERCISE_CATALOG).concat(workoutState.custom);
    const filtered = all.filter(x => muscleFilter === 'All' || x.muscle === muscleFilter);

    const h = `
      <div class="grab"></div>
      <h4>Add Exercise</h4>
      <p>Choose an exercise from the library, or create a custom one.</p>
      <button class="cta2 ghost" id="btn-create-custom-ex">+ CREATE CUSTOM EXERCISE</button>
      <div class="lbl" style="margin-top:16px">MUSCLE GROUP</div>
      <div>
        ${['All', ...MUSCLE_GROUPS].map(m => `
          <span class="chip ${muscleFilter === m ? 'on' : ''}" data-mf="${m}">${m}</span>
        `).join('')}
      </div>
      <div style="margin-top:12px">
        ${filtered.map(x => `
          <div class="pl" data-add-id="${x.id}">
            <div><b>${esc(x.name)}</b><small>${x.muscle} · ${LV[x.level]}</small></div>
            <div class="pr" style="font-size:22px">+</div>
          </div>
        `).join('')}
      </div>
    `;

    openSheet(h);

    document.getElementById('btn-create-custom-ex').onclick = openCreateExerciseModal;

    sheet.querySelectorAll('[data-mf]').forEach(c => {
      c.onclick = () => {
        muscleFilter = c.getAttribute('data-mf');
        openAddExerciseSheet();
      };
    });

    sheet.querySelectorAll('[data-add-id]').forEach(r => {
      r.onclick = () => {
        const id = r.getAttribute('data-add-id');
        const items = getDayItems().slice();
        items.push({ id, sets: '3×10' });
        setDayItems(items);
        renderWorkoutDay();
        closeSheet();
        say(`Added to workout!`);
        SoundFX.success();
      };
    });
  }

  function openSwapSheet(index) {
    const items = getDayItems();
    const current = getExercise(items[index].id);
    const all = Object.values(EXERCISE_CATALOG).concat(workoutState.custom);
    const candidates = all.filter(x => x.muscle === current.muscle && x.id !== current.id);

    const h = `
      <div class="grab"></div>
      <h4>Swap Variation</h4>
      <p>Alternative ${current.muscle.toLowerCase()} exercises to substitute for <b>${esc(current.name)}</b>:</p>
      <div style="margin-top:14px">
        ${candidates.map(x => `
          <div class="pl" data-swap-id="${x.id}">
            <div><b>${esc(x.name)}</b><small>${x.muscle} · ${LV[x.level]}</small></div>
            <div class="pr">⇄</div>
          </div>
        `).join('')}
      </div>
    `;

    openSheet(h);

    sheet.querySelectorAll('[data-swap-id]').forEach(r => {
      r.onclick = () => {
        const newId = r.getAttribute('data-swap-id');
        const next = items.slice();
        next[index] = { id: newId, sets: next[index].sets };
        setDayItems(next);
        renderWorkoutDay();
        closeSheet();
        say('Exercise variation swapped!');
        SoundFX.success();
      };
    });
  }

  function openCreateExerciseModal() {
    let customPhoto = '';
    const h = `
      <div class="grab"></div>
      <h4>Create Custom Exercise</h4>
      <p>Add your own movement variation. Saved to your profile.</p>
      <div class="lbl">NAME</div>
      <input class="tx" id="cn-name" placeholder="e.g. Incline Cable Press">
      <div class="lbl" style="margin-top:12px">MUSCLE GROUP</div>
      <select class="tx" id="cn-muscle">${MUSCLE_GROUPS.map(m => `<option>${m}</option>`).join('')}</select>
      <div class="lbl" style="margin-top:12px">DIFFICULTY LEVEL</div>
      <select class="tx" id="cn-level">
        <option value="b">Beginner</option>
        <option value="m">Moderate</option>
        <option value="a">Advanced</option>
      </select>
      <div class="lbl" style="margin-top:12px">PLANNED SETS × REPS</div>
      <input class="tx" id="cn-sets" value="3×10">
      <div class="lbl" style="margin-top:12px">TECHNIQUE CUES (ONE PER LINE)</div>
      <textarea class="ta" id="cn-steps" placeholder="Pin shoulder blades...&#10;Drive smoothly...&#10;Control eccentric stretch..."></textarea>
      <div class="lbl" style="margin-top:12px">ADVANTAGE / PURPOSE</div>
      <textarea class="ta" id="cn-adv" placeholder="Why do you train this exercise?"></textarea>
      <button class="cta2" id="btn-save-custom-ex" style="margin-top:18px">SAVE &amp; INSERT TO WORKOUT</button>
    `;

    openSheet(h);

    document.getElementById('btn-save-custom-ex').onclick = () => {
      const name = document.getElementById('cn-name').value.trim();
      if (!name) { say('Please provide an exercise name'); return; }

      const newEx = {
        id: 'cust_' + Date.now(),
        name,
        muscle: document.getElementById('cn-muscle').value,
        level: document.getElementById('cn-level').value,
        steps: document.getElementById('cn-steps').value.split('\n').map(s => s.trim()).filter(Boolean),
        advantage: document.getElementById('cn-adv').value.trim() || 'Custom athlete variation.',
        photo: customPhoto
      };
      if (!newEx.steps.length) newEx.steps = ['Execute with full range of motion.'];

      workoutState.custom.push(newEx);
      const items = getDayItems().slice();
      items.push({ id: newEx.id, sets: document.getElementById('cn-sets').value.trim() || '3×10' });
      setDayItems(items);
      API.workouts.saveState({ custom: workoutState.custom }).catch(() => {});

      renderWorkoutDay();
      closeSheet();
      say(`Created and added ${name}!`);
      SoundFX.success();
    };
  }

  // ------------------------------------------------------------------------
  // Gym Passport Scene (NEW)
  // ------------------------------------------------------------------------
  function initPassport() {
    document.getElementById('pass-back').onclick = () => showScene('home');
    loadPassportData();
    document.getElementById('btn-passport-checkin').onclick = openPassportCheckinSheet;
  }

  async function loadPassportData() {
    try {
      const res = await API.passport.get();
      renderPassportView(res);
    } catch(e) {
      renderPassportView({
        stamps: [
          { gymName: 'Starts Gym', city: 'Vijayawada', area: 'Tadepalli', visitedDate: '2026-10-18', badgeEarned: 'First Sweat' },
          { gymName: 'Cult.Fit Elite', city: 'Hyderabad', area: 'Madhapur', visitedDate: '2026-09-24', badgeEarned: 'Cyber Lifter' }
        ],
        badges: [
          { title: 'First Sweat', icon: '🏋️‍♂️', unlocked: true },
          { title: 'City Hopper', icon: '✈️', unlocked: true },
          { title: 'Iron Nomad', icon: '🌐', unlocked: true },
          { title: 'Streak Crusher', icon: '🔥', unlocked: true }
        ],
        stats: { totalGyms: 2, totalCities: 2 }
      });
    }
  }

  function renderPassportView(data) {
    const statsBox = document.getElementById('passport-stats');
    const stampsBox = document.getElementById('passport-stamps');
    const badgesBox = document.getElementById('passport-badges');

    statsBox.innerHTML = `
      <div class="pass-card a" style="--d:.1s">
        <div class="pass-header">
          <div class="pass-title">OFFICIAL FITNESS PASSPORT</div>
          <div class="pass-emblem">🇮🇳</div>
        </div>
        <div>
          <b style="font-size:16px;">${currentUser.name || 'Alex Turner'}</b>
          <small style="color:var(--muted);display:block;">Passport No: GG-IND-${hash(currentUser.name || 'A') % 800000 + 100000}</small>
        </div>
        <div class="pass-stats-row">
          <div class="pass-stat">
            <b>${data.stats ? data.stats.totalGyms : data.stamps.length}</b>
            <small>GYMS VISITED</small>
          </div>
          <div class="pass-stat">
            <b>${data.stats ? data.stats.totalCities : new Set(data.stamps.map(s => s.city)).size}</b>
            <small>CITIES CONQUERED</small>
          </div>
          <div class="pass-stat">
            <b>${data.badges ? data.badges.filter(b => b.unlocked).length : 4}</b>
            <small>BADGES EARNED</small>
          </div>
        </div>
      </div>
    `;

    badgesBox.innerHTML = `
      <div class="lbl">ACHIEVEMENT BADGES</div>
      <div class="badges-row a" style="--d:.2s">
        ${(data.badges || []).map(b => `
          <div class="badge-pill ${b.unlocked ? 'on' : ''}">
            <span>${b.icon}</span>
            <b>${b.title}</b>
          </div>
        `).join('')}
      </div>
    `;

    stampsBox.innerHTML = `
      <div class="lbl" style="margin-top:20px;">CITY CHECK-IN STAMPS</div>
      <div class="stamps-grid a" style="--d:.3s">
        ${(data.stamps || []).map(s => `
          <div class="stamp-card active">
            <div>
              <div class="stamp-seal">★ GG</div>
              <div class="stamp-city">${s.city.toUpperCase()}</div>
              <div class="stamp-gym">${s.gymName}</div>
            </div>
            <div class="stamp-date">STAMPED: ${fmt(s.visitedDate)}</div>
          </div>
        `).join('')}
        <div class="stamp-card" id="btn-next-stamp" style="cursor:pointer;justify-content:center;align-items:center;text-align:center;">
          <div style="font-size:24px;color:var(--accent);">+</div>
          <small style="color:var(--muted);margin-top:6px;">Check in at next gym</small>
        </div>
      </div>
    `;

    const nextStampBtn = document.getElementById('btn-next-stamp');
    if (nextStampBtn) nextStampBtn.onclick = openPassportCheckinSheet;
  }

  function openPassportCheckinSheet() {
    const defaultGyms = [
      ['Starts Gym', 'Vijayawada', 'Tadepalli'],
      ['Cult.Fit Elite', 'Hyderabad', 'Madhapur'],
      ['Nitro Fitness Club', 'Bengaluru', 'Indiranagar'],
      ['Iron Nation', 'Vijayawada', 'Benz Circle'],
      ['Gold\'s Gym', 'Hyderabad', 'Gachibowli']
    ];

    const h = `
      <div class="grab"></div>
      <h4>Stamp My Gym Passport</h4>
      <p>Log a check-in at your current gym to earn city stamps and badges.</p>
      <div class="lbl">POPULAR GYMS</div>
      ${defaultGyms.map(g => `
        <div class="pl" data-stamp-gym="${g[0]}" data-stamp-city="${g[1]}" data-stamp-area="${g[2]}">
          <div><b>${g[0]}</b><small>${g[2]}, ${g[1]}</small></div>
          <div class="pr">STAMP</div>
        </div>
      `).join('')}
      <div class="lbl" style="margin-top:16px;">OR ENTER CUSTOM GYM</div>
      <input class="tx" id="custom-gym-name" placeholder="Gym name (e.g. Powerhouse Gym)">
      <input class="tx" id="custom-gym-city" placeholder="City (e.g. Visakhapatnam)" style="margin-top:8px;">
      <button class="cta2" id="btn-do-custom-stamp" style="margin-top:14px;">VERIFY &amp; STAMP</button>
    `;

    openSheet(h);

    sheet.querySelectorAll('[data-stamp-gym]').forEach(row => {
      row.onclick = async () => {
        const gymName = row.getAttribute('data-stamp-gym');
        const city = row.getAttribute('data-stamp-city');
        const area = row.getAttribute('data-stamp-area');
        try {
          await API.passport.checkIn({ gymName, city, area });
        } catch(e) {}
        closeSheet();
        SoundFX.success();
        say(`Passport stamped for ${gymName}, ${city}! 🇮🇳`);
        loadPassportData();
      };
    });

    document.getElementById('btn-do-custom-stamp').onclick = async () => {
      const gymName = document.getElementById('custom-gym-name').value.trim();
      const city = document.getElementById('custom-gym-city').value.trim();
      if (!gymName || !city) { say('Enter gym name and city'); return; }

      try {
        await API.passport.checkIn({ gymName, city });
      } catch(e) {}
      closeSheet();
      SoundFX.success();
      say(`Passport stamped for ${gymName}, ${city}!`);
      loadPassportData();
    };
  }

  // ------------------------------------------------------------------------
  // GymGram Social Community Feed (NEW)
  // ------------------------------------------------------------------------
  function initGymgram() {
    document.getElementById('gram-back').onclick = () => showScene('home');
    document.getElementById('btn-new-post').onclick = openCreatePostSheet;
    loadGymgramPosts();
  }

  async function loadGymgramPosts() {
    const feed = document.getElementById('gram-feed');
    feed.innerHTML = '<div class="msg"><i class="sp"></i>Loading GymGram community feed...</div>';

    try {
      const res = await API.gymgram.getPosts();
      renderGymgramPosts(res.posts || []);
    } catch(e) {
      renderGymgramPosts([
        {
          id: 'post_fb_1',
          authorName: 'Alex Turner',
          authorAvatar: 'A',
          location: 'Starts Gym · Tadepalli',
          caption: 'Hit a smooth 105 kg bench press on my GymGo travel pass! 🔥',
          tag: 'PR Alert 🏆',
          workoutType: 'Chest & Triceps',
          likes: 28,
          likedBy: [],
          comments: [{ author: 'Vikram Rao', text: 'Great form today!' }],
          timeAgo: '2h ago'
        }
      ]);
    }
  }

  function renderGymgramPosts(posts) {
    const feed = document.getElementById('gram-feed');
    if (!posts.length) {
      feed.innerHTML = `<div class="msg">No posts yet. Be the first to share your workout milestone!</div>`;
      return;
    }

    feed.innerHTML = posts.map(p => {
      const isLiked = p.likedBy && p.likedBy.includes(currentUser.id);
      return `
        <div class="post-card" data-post-id="${p.id}">
          <div class="post-head">
            <div class="post-author">
              <div class="av">${p.authorAvatar || p.authorName.charAt(0)}</div>
              <div>
                <b>${esc(p.authorName)}</b>
                <small>${esc(p.location)} · ${esc(p.timeAgo || 'Just now')}</small>
              </div>
            </div>
            <span class="post-tag">${esc(p.tag || 'Daily Grind 🔥')}</span>
          </div>

          <div class="post-text">${esc(p.caption)}</div>
          ${p.photo ? `<img src="${p.photo}" class="xph" style="margin-top:0;margin-bottom:12px;" alt="">` : ''}

          <div class="post-actions">
            <button class="post-act-btn btn-like ${isLiked ? 'liked' : ''}">
              <span>${isLiked ? '❤️' : '🤍'}</span>
              <span class="like-count">${p.likes || 0}</span>
            </button>
            <button class="post-act-btn btn-comment-toggle">
              <span>💬</span>
              <span>${(p.comments || []).length} Comments</span>
            </button>
          </div>

          <div class="comments-box">
            <div class="comments-list">
              ${(p.comments || []).map(c => `
                <div class="c-item"><b>${esc(c.author)}:</b> ${esc(c.text)}</div>
              `).join('')}
            </div>
            <div class="c-input-row">
              <input type="text" placeholder="Add a comment..." class="tx c-input">
              <button class="btn-send-comment">POST</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  gymgram.addEventListener('click', async (ev) => {
    const likeBtn = ev.target.closest('.btn-like');
    if (likeBtn) {
      const postCard = likeBtn.closest('.post-card');
      const postId = postCard.getAttribute('data-post-id');
      try {
        const res = await API.gymgram.likePost(postId);
        likeBtn.classList.toggle('liked', res.liked);
        likeBtn.querySelector('span:first-child').textContent = res.liked ? '❤️' : '🤍';
        likeBtn.querySelector('.like-count').textContent = res.likes;
        SoundFX.like();
      } catch(e) {}
      return;
    }

    const commentToggle = ev.target.closest('.btn-comment-toggle');
    if (commentToggle) {
      const postCard = commentToggle.closest('.post-card');
      const box = postCard.querySelector('.comments-box');
      box.classList.toggle('show');
      SoundFX.tick();
      return;
    }

    const commentSend = ev.target.closest('.btn-send-comment');
    if (commentSend) {
      const postCard = commentSend.closest('.post-card');
      const postId = postCard.getAttribute('data-post-id');
      const input = postCard.querySelector('.c-input');
      const text = input.value.trim();
      if (!text) return;

      try {
        const res = await API.gymgram.addComment(postId, text);
        const list = postCard.querySelector('.comments-list');
        list.innerHTML += `<div class="c-item"><b>${esc(res.comment.author)}:</b> ${esc(res.comment.text)}</div>`;
        input.value = '';
        SoundFX.tick();
      } catch(e) {}
      return;
    }
  });

  function openCreatePostSheet() {
    let postPhoto = '';
    const h = `
      <div class="grab"></div>
      <h4>Share Workout on GymGram</h4>
      <p>Inspire the community with your PRs, pump, or travel gym check-in.</p>
      <div class="lbl">CAPTION</div>
      <textarea class="ta" id="post-caption" placeholder="e.g. Smashed a new squat PR at Starts Gym today! 🔥"></textarea>
      <div class="lbl" style="margin-top:12px;">TAG / BADGE</div>
      <select class="tx" id="post-tag-select">
        <option>PR Alert 🏆</option>
        <option>Travel Gym Check-in 📍</option>
        <option>Daily Grind 🔥</option>
        <option>Morning Pump ⚡</option>
        <option>Leg Day Survivor 🍗</option>
      </select>
      <div class="lbl" style="margin-top:12px;">WORKOUT TYPE</div>
      <input class="tx" id="post-wo-type" placeholder="e.g. Chest &amp; Triceps">
      <div class="lbl" style="margin-top:12px;">GYM LOCATION</div>
      <input class="tx" id="post-loc" value="${currentUser.homeCity || 'Vijayawada'} · Fitness Center">
      <button class="cta2" id="btn-submit-post" style="margin-top:18px;">POST TO COMMUNITY</button>
    `;

    openSheet(h);

    document.getElementById('btn-submit-post').onclick = async () => {
      const caption = document.getElementById('post-caption').value.trim();
      if (!caption) { say('Please write a caption'); return; }

      const data = {
        caption,
        tag: document.getElementById('post-tag-select').value,
        workoutType: document.getElementById('post-wo-type').value || 'Workout',
        location: document.getElementById('post-loc').value || 'GymGo Partner Gym',
        photo: postPhoto
      };

      try {
        await API.gymgram.createPost(data);
        closeSheet();
        say('Post published to GymGram! 🔥');
        SoundFX.success();
        loadGymgramPosts();
      } catch(e) {
        say('Failed to publish post');
      }
    };
  }

  // ------------------------------------------------------------------------
  // My Passes QR Wallet Scene (NEW)
  // ------------------------------------------------------------------------
  function initPasses() {
    document.getElementById('passes-back').onclick = () => showScene('home');
    loadPassesView();
  }

  async function loadPassesView() {
    const wallet = document.getElementById('passes-wallet');
    wallet.innerHTML = '<div class="msg"><i class="sp"></i>Loading your gym passes...</div>';

    try {
      const res = await API.bookings.list();
      const passesList = (res.bookings || []).filter(b => b.status === 'paid');
      renderPassesList(passesList);
    } catch(e) {
      renderPassesList([
        {
          id: 'GG-84291',
          gymName: 'Starts Gym',
          city: 'Vijayawada',
          area: 'Tadepalli',
          planName: '1 Week',
          startDate: '2026-10-18',
          endDate: '2026-10-24',
          slot: '5–7 PM',
          amount: 750
        }
      ]);
    }
  }

  function renderPassesList(list) {
    const wallet = document.getElementById('passes-wallet');
    if (!list.length) {
      wallet.innerHTML = `
        <div class="msg">You have no active gym passes right now.</div>
        <button class="cta2" id="btn-wallet-book-now">FIND A TRAVEL GYM</button>
      `;
      const bookBtn = document.getElementById('btn-wallet-book-now');
      if (bookBtn) bookBtn.onclick = () => showScene('travel');
      return;
    }

    wallet.innerHTML = list.map(p => `
      <div class="pass-ticket">
        <div class="ticket-row">
          <div>
            <h3 class="ticket-gym">${esc(p.gymName)}</h3>
            <div class="ticket-loc">📍 ${esc(p.area || p.city)}, ${esc(p.city)}</div>
          </div>
        </div>

        <div class="ticket-grid">
          <div>
            <span>VALIDITY</span>
            <b>${fmt(p.startDate)} - ${fmt(p.endDate)}</b>
          </div>
          <div>
            <span>DAILY SLOT</span>
            <b>${p.slot || 'Daily Access'}</b>
          </div>
          <div>
            <span>PLAN DURATION</span>
            <b>${p.planName || '1 Week'}</b>
          </div>
          <div>
            <span>PASS IDENTIFIER</span>
            <b>${p.id}</b>
          </div>
        </div>

        <div class="pass" style="margin:10px 0 14px;">
          <div class="qr">${qrSvg(p.id)}</div>
          <div>
            <b>VERIFIED GYMGO PASS</b>
            <small>Scan this QR at front desk</small>
            <small style="color:var(--accent);">Status: ${p.checkedInAt ? 'Checked In Today ✓' : 'Ready to Scan'}</small>
          </div>
        </div>

        <button class="cta2" data-verify-pass-id="${p.id}">
          ${p.checkedInAt ? 'VERIFIED TODAY ✓' : 'FRONT DESK CHECK-IN SCAN'}
        </button>
      </div>
    `).join('');

    wallet.querySelectorAll('[data-verify-pass-id]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-verify-pass-id');
        btn.disabled = true;
        btn.textContent = 'SCANNING QR BARCODE...';
        SoundFX.tick();

        try {
          await API.bookings.checkIn(id);
        } catch(e) {}

        setTimeout(() => {
          SoundFX.success();
          say('QR Scanned! Check-in confirmed at front desk. Have a great workout! 🏋️');
          loadPassesView();
        }, 1000);
      };
    });
  }

  // ------------------------------------------------------------------------
  // Profile Scene (NEW)
  // ------------------------------------------------------------------------
  function initProfile() {
    document.getElementById('prof-back').onclick = () => showScene('home');
    renderProfileView();
  }

  function renderProfileView() {
    const profBox = document.getElementById('profile-box');
    profBox.innerHTML = `
      <div class="profile-card a" style="--d:.1s">
        <div class="profile-av">${(currentUser.avatar || currentUser.name.charAt(0)).toUpperCase()}</div>
        <h3>${esc(currentUser.name)}</h3>
        <p>${esc(currentUser.email || `${currentUser.username}@gymgo.fit`)}</p>
        <span class="role-badge">${currentUser.role.toUpperCase()} ACCOUNT</span>
      </div>

      <div class="lbl">PERSONAL BENCHMARKS (PRS)</div>
      <div class="pr-grid a" style="--d:.2s">
        <div class="pr-box">
          <small>Bench Press</small>
          <b>${currentUser.prs ? currentUser.prs.bench : '105 kg'}</b>
        </div>
        <div class="pr-box">
          <small>Back Squat</small>
          <b>${currentUser.prs ? currentUser.prs.squat : '145 kg'}</b>
        </div>
        <div class="pr-box">
          <small>Deadlift</small>
          <b>${currentUser.prs ? currentUser.prs.deadlift : '185 kg'}</b>
        </div>
      </div>

      <div class="lbl" style="margin-top:20px;">ACCOUNT SWITCHER</div>
      <div class="pl a" style="--d:.3s" id="btn-switch-to-owner">
        <div>
          <b>Switch to Gym Owner Mode</b>
          <small>Manage member requests, bookings &amp; time slots</small>
        </div>
        <div class="pr">→</div>
      </div>

      <div class="pl a" style="--d:.35s" id="btn-switch-to-athlete">
        <div>
          <b>Switch to Athlete Mode</b>
          <small>Browse travel gyms, log workouts &amp; view AI coach</small>
        </div>
        <div class="pr">→</div>
      </div>

      <button class="ghostb a" style="--d:.4s;margin-top:20px;" id="btn-logout">
        LOG OUT OF GYMGO
      </button>
    `;

    document.getElementById('btn-switch-to-owner').onclick = async () => {
      await API.auth.switchRole('owner');
      currentUser = API.getCurrentUser();
      say('Switched to Gym Owner portal');
      showScene('owner');
    };

    document.getElementById('btn-switch-to-athlete').onclick = async () => {
      await API.auth.switchRole('athlete');
      currentUser = API.getCurrentUser();
      say('Switched to Athlete dashboard');
      showScene('home');
    };

    document.getElementById('btn-logout').onclick = () => {
      playIntro();
      say('Logged out successfully');
    };
  }

  // Start with logo intro
  playIntro();
})();
