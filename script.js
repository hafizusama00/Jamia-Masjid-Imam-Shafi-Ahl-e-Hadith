/* ═══════════════════════════════════════════════════════════════════
   Jamia Masjid Imam Shafi Ahl-e-Hadith — script.js
   ═══════════════════════════════════════════════════════════════════ */

const PRAYER_TIMES_CONFIG = {
  city: 'Islamabad',
  country: 'Pakistan',
  timeZone: 'Asia/Karachi',
  method: 1, // University of Islamic Sciences, Karachi
  school: 0, // Shafi'i Asr calculation
  jummah: 'Update Soon',
};

const AUTOMATIC_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/* ─────────────────────────────────────────────────────────────────── */
/*  INIT                                                               */
/* ─────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initPrayerTimes();
  initNavbar();
  initHamburger();
  initScrollReveal();
  setFooterYear();
});

/* ─── Daily Prayer Times ─────────────────────────────────────────── */
function getPrayerDate() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PRAYER_TIMES_CONFIG.timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${date.day}-${date.month}-${date.year}`;
}

function formatPrayerTime(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) throw new Error('Prayer time is missing or invalid');

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error('Prayer time is outside the valid range');

  const period = hour < 12 ? 'AM' : 'PM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${period}`;
}

function setPrayerTime(name, value) {
  const element = document.querySelector(`[data-prayer-time="${name}"]`);
  if (element) element.textContent = value;
}

function initPrayerTimes() {
  const prayerGrid = document.querySelector('.prayer-grid');
  if (!prayerGrid) return;

  let requestedDate = '';
  let requestInProgress = false;
  let retryTimer;
  setPrayerTime('Jummah', PRAYER_TIMES_CONFIG.jummah);

  const loadPrayerTimes = async () => {
    if (requestInProgress) return;

    const date = getPrayerDate();
    requestedDate = date;
    requestInProgress = true;
    prayerGrid.setAttribute('aria-busy', 'true');
    AUTOMATIC_PRAYERS.forEach(name => setPrayerTime(name, 'Loading...'));

    const params = new URLSearchParams({
      city: PRAYER_TIMES_CONFIG.city,
      country: PRAYER_TIMES_CONFIG.country,
      method: String(PRAYER_TIMES_CONFIG.method),
      school: String(PRAYER_TIMES_CONFIG.school),
    });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `https://api.aladhan.com/v1/timingsByCity/${date}?${params}`,
        { signal: controller.signal, cache: 'no-store' }
      );
      if (!response.ok) throw new Error(`Prayer API returned HTTP ${response.status}`);

      const result = await response.json();
      if (result.code !== 200 || !result.data?.timings) {
        throw new Error('Prayer API response did not contain timings');
      }

      if (date !== getPrayerDate()) return;
      AUTOMATIC_PRAYERS.forEach(name => {
        setPrayerTime(name, formatPrayerTime(result.data.timings[name]));
      });
      window.clearTimeout(retryTimer);
    } catch {
      if (date === getPrayerDate()) {
        AUTOMATIC_PRAYERS.forEach(name => {
          setPrayerTime(name, 'Prayer times temporarily unavailable');
        });
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(loadPrayerTimes, 5 * 60 * 1000);
      }
    } finally {
      window.clearTimeout(timeout);
      requestInProgress = false;
      prayerGrid.setAttribute('aria-busy', 'false');
    }
  };

  loadPrayerTimes();

  const refreshForNewDay = () => {
    if (!requestInProgress && getPrayerDate() !== requestedDate) loadPrayerTimes();
  };
  window.setInterval(refreshForNewDay, 60000);
  window.addEventListener('online', () => {
    if (AUTOMATIC_PRAYERS.some(name => {
      const element = document.querySelector(`[data-prayer-time="${name}"]`);
      return element?.textContent === 'Prayer times temporarily unavailable';
    })) loadPrayerTimes();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshForNewDay();
  });
}

/* ─── Navbar Scroll Behaviour ───────────────────────────────────── */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  let ticking = false;
  const updateNavbar = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
    ticking = false;
  };

  updateNavbar();

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateNavbar);
      ticking = true;
    }
  }, { passive: true });
}

/* ─── Hamburger Menu ────────────────────────────────────────────── */
function initHamburger() {
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');
  if (!hamburger || !navLinks) return;

  const mobileMenu = window.matchMedia('(max-width: 900px)');
  const setMenuOpen = (isOpen) => {
    navLinks.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    navLinks.inert = mobileMenu.matches && !isOpen;
  };

  setMenuOpen(false);
  mobileMenu.addEventListener('change', () => setMenuOpen(false));

  hamburger.addEventListener('click', () => {
    setMenuOpen(hamburger.getAttribute('aria-expanded') !== 'true');
  });

  // Close on nav link click
  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      setMenuOpen(false);
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
      setMenuOpen(false);
    }
  });

  // Keyboard: Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hamburger.getAttribute('aria-expanded') === 'true') {
      setMenuOpen(false);
      hamburger.focus();
    }
  });
}

/* ─── Scroll Reveal (IntersectionObserver) ──────────────────────── */
function initScrollReveal() {
  // Skip if user prefers reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
      el.classList.add('visible');
    });
    return;
  }

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
      el.classList.add('visible');
    });
    return;
  }

  const options = {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px',
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); // fire once
      }
    });
  }, options);

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
    observer.observe(el);
  });
}

/* ─── Footer Year ───────────────────────────────────────────────── */
function setFooterYear() {
  const el = document.getElementById('footer-year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ─── Smooth Active Nav Highlight ──────────────────────────────── */
(function initActiveNav() {
  if (!('IntersectionObserver' in window)) return;

  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  if (!sections.length || !navLinks.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          const isActive = link.getAttribute('href') === `#${entry.target.id}`;
          link.classList.toggle('nav-link--active', isActive);
          if (isActive) {
            link.setAttribute('aria-current', 'location');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

  sections.forEach(s => obs.observe(s));
})();
