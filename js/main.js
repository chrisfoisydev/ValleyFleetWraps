/* ==========================================================================
   Valley Fleet Wraps — main.js
   Navigation, GSAP scroll animations, and lead-form handling.
   Everything degrades gracefully if GSAP fails to load.
   ========================================================================== */

(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =========================================================
     Sticky header state
     ========================================================= */
  var header = document.getElementById('site-header');

  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* =========================================================
     Mobile navigation
     ========================================================= */
  var navToggle = document.getElementById('nav-toggle');
  var mainNav = document.getElementById('main-nav');

  function setNav(open) {
    mainNav.classList.toggle('is-open', open);
    header.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  }

  navToggle.addEventListener('click', function () {
    setNav(!mainNav.classList.contains('is-open'));
  });

  // Close the mobile menu after choosing a destination or tapping outside it.
  mainNav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') setNav(false);
  });
  document.addEventListener('click', function (e) {
    if (mainNav.classList.contains('is-open') && !header.contains(e.target)) setNav(false);
  });

  /* =========================================================
     Track + package CTAs → pre-fill the form so it matches the
     visitor's intent (which track they're on, what they need).
     ========================================================= */
  var needMap = {
    'starter': 'lettering',
    'dominator': 'partial',
    'market-leader': 'full',
    'refresh': 'refresh'
  };

  var trackMap = {
    'unwrapped': 'Not wrapped yet',
    'rewrap': 'Wrapped - needs a redo'
  };

  function setFleetStatus(value) {
    var radio = document.querySelector('input[name="fleet_status"][value="' + value + '"]');
    if (radio) radio.checked = true;
  }

  document.querySelectorAll('.package-cta, .track-cta').forEach(function (cta) {
    cta.addEventListener('click', function () {
      var need = needMap[cta.getAttribute('data-need')];
      var select = document.getElementById('f-need');
      if (need && select) select.value = need;

      var track = trackMap[cta.getAttribute('data-track')];
      if (track) setFleetStatus(track);
      // Rewrap intent implies the refresh service unless something
      // more specific was already chosen.
      if (cta.getAttribute('data-track') === 'rewrap' && select && !select.value) {
        select.value = 'refresh';
      }
    });
  });

  /* =========================================================
     Footer year
     ========================================================= */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* =========================================================
     GSAP scroll animations
     ========================================================= */
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && !prefersReducedMotion) {
    gsap.registerPlugin(ScrollTrigger);

    // Hero: staggered entrance for the copy.
    gsap.from('[data-hero-item]', {
      y: 36,
      opacity: 0,
      duration: 0.9,
      stagger: 0.12,
      ease: 'power3.out',
      delay: 0.15
    });

    // Section reveals: single elements.
    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      gsap.from(el, {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      });
    });

    // Section reveals: grids/lists stagger their children.
    gsap.utils.toArray('[data-reveal-group]').forEach(function (group) {
      gsap.from(group.children, {
        y: 40,
        opacity: 0,
        duration: 0.7,
        stagger: 0.09,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: group,
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      });
    });

  }

  /* =========================================================
     Lead form — client-side validation + submission stub
     =========================================================
     CONNECT YOUR CRM / AUTOMATION HERE.
     Set FORM_ENDPOINT to one of:
       • Zapier Catch Hook:  https://hooks.zapier.com/hooks/catch/XXXX/XXXX/
       • Airtable webhook:   https://hooks.airtable.com/workflows/v1/...
       • Formspree (email):  https://formspree.io/f/XXXX
       • Your own API route.
     For HubSpot, either swap this form for a HubSpot embed or POST the
     payload to the HubSpot Forms API. Full notes in README.md.
     ========================================================= */
  var FORM_ENDPOINT = ''; // ← leave empty until an endpoint exists

  var form = document.getElementById('lead-form');
  var errorEl = document.getElementById('form-error');
  var successEl = document.getElementById('form-success');

  /* Two-step flow: step 1 is the lead (name + phone), step 2 the details. */
  var step1 = document.getElementById('form-step-1');
  var step2 = document.getElementById('form-step-2');
  var stepLabel = document.getElementById('form-step-label');
  var nextBtn = document.getElementById('form-next');
  var backBtn = document.getElementById('form-back');

  function setStep(n) {
    step1.hidden = n !== 1;
    step2.hidden = n !== 2;
    stepLabel.textContent = n === 1
      ? 'Step 1 of 2 · How do we reach you?'
      : 'Step 2 of 2 · Tell us about your fleet';
  }

  function fieldValid(field) {
    var value = field.value.trim();
    if (field.hasAttribute('required') && value === '') return false;
    if (value !== '' && field.type === 'email') {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }
    if (value !== '' && field.type === 'tel') {
      return value.replace(/\D/g, '').length >= 10;
    }
    return true;
  }

  // Validates text-like fields within a step (or the whole form).
  function validate(scope) {
    var valid = true;
    scope.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]').forEach(function (field) {
      var ok = fieldValid(field);
      field.classList.toggle('is-invalid', !ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  function showFirstInvalid(scope) {
    var firstInvalid = scope.querySelector('.is-invalid');
    if (firstInvalid) firstInvalid.focus();
  }

  nextBtn.addEventListener('click', function () {
    errorEl.hidden = true;
    if (!validate(step1)) {
      errorEl.hidden = false;
      showFirstInvalid(step1);
      return;
    }
    setStep(2);
  });

  backBtn.addEventListener('click', function () {
    errorEl.hidden = true;
    setStep(1);
  });

  // Clear invalid state as the visitor fixes a field.
  form.addEventListener('input', function (e) {
    if (e.target.classList && e.target.classList.contains('is-invalid')) {
      e.target.classList.remove('is-invalid');
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorEl.hidden = true;
    successEl.hidden = true;

    if (!validate(form)) {
      errorEl.hidden = false;
      // A required field lives on step 1 — bring the visitor back to it.
      if (step1.querySelector('.is-invalid')) setStep(1);
      showFirstInvalid(form);
      return;
    }

    // Serialize the form, collecting checkbox groups into arrays.
    var data = {};
    new FormData(form).forEach(function (value, key) {
      if (data[key] !== undefined) {
        if (!Array.isArray(data[key])) data[key] = [data[key]];
        data[key].push(value);
      } else {
        data[key] = value;
      }
    });
    data.source = 'valleyfleetwraps.com — Free Fleet Visibility Audit form';
    data.submitted_at = new Date().toISOString();

    var submitBtn = form.querySelector('button[type="submit"]');

    if (FORM_ENDPOINT) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Request failed: ' + res.status);
          showSuccess();
        })
        .catch(function () {
          errorEl.textContent = 'Something went wrong sending your request. Please call or email us instead.';
          errorEl.hidden = false;
        })
        .then(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Request My Free Audit';
        });
    } else {
      // No endpoint configured yet: log the payload and show success so the
      // full UX can be reviewed before the CRM hookup.
      console.info('[Valley Fleet Wraps] Lead payload (connect FORM_ENDPOINT to deliver):', data);
      showSuccess();
    }

    function showSuccess() {
      form.reset();
      setStep(1);
      successEl.hidden = false;
      successEl.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
    }
  });
})();
