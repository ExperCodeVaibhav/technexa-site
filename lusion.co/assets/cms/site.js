const API_BASE = (globalThis.TECHNEXA_CMS_API || 'https://technexa-cms-api.vercel.app').replace(/\/$/, '');
const modulePath = new URL(import.meta.url).pathname;
const marker = '/assets/cms/site.js';
const SITE_BASE = modulePath.endsWith(marker) ? modulePath.slice(0, -marker.length) : '';

function siteUrl(value) {
  if (!value) return '#';
  if (/^https?:\/\//i.test(value) || value.startsWith('mailto:') || value.startsWith('tel:')) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${SITE_BASE}${path}` || '/';
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
}

function ensureProjectImage(card, project) {
  const main = card.querySelector('.project-item-main');
  if (!main) return;
  let image = main.querySelector('.cms-project-image');
  if (!image) {
    image = document.createElement('img');
    image.className = 'cms-project-image';
    image.loading = 'lazy';
    image.addEventListener('error', () => image.remove());
    main.append(image);
  }
  image.src = project.image.startsWith('/') ? siteUrl(project.image) : safeExternalUrl(project.image);
  image.alt = project.title;
}

function createProjectCard() {
  const card = document.createElement('a');
  card.className = 'project-item cms-project-item';
  card.innerHTML = '<div class="project-item-main"><div class="project-item-image"></div></div><div class="project-item-footer"><div class="project-item-line-1"></div><div class="project-item-line-2"><div class="project-item-line-2-icon"></div><div class="project-item-line-2-inner"></div></div><p class="cms-project-description"></p></div>';
  return card;
}

function updateProjectCard(card, project) {
  card.hidden = false;
  card.dataset.cmsId = project.id;
  card.dataset.id ||= project.id;
  const external = /^https?:\/\//i.test(project.url);
  card.href = external ? safeExternalUrl(project.url) : siteUrl(project.url);
  if (external) {
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.dataset.linkType = 'regular';
  } else {
    card.removeAttribute('target');
    card.removeAttribute('rel');
  }
  const meta = card.querySelector('.project-item-line-1');
  const title = card.querySelector('.project-item-line-2-inner');
  let description = card.querySelector('.cms-project-description');
  if (!description) {
    description = document.createElement('p');
    description.className = 'cms-project-description';
    card.querySelector('.project-item-footer')?.append(description);
  }
  if (meta) meta.textContent = `${project.category} • ${project.year}`;
  if (title) title.textContent = project.title;
  description.textContent = project.description || '';
  ensureProjectImage(card, project);
}

function applyProjects(list, projects) {
  const cards = [...list.querySelectorAll(':scope > .project-item')];
  projects.forEach((project, index) => {
    const card = cards[index] || createProjectCard();
    if (!cards[index]) list.append(card);
    updateProjectCard(card, project);
  });
  cards.slice(projects.length).forEach(card => { card.hidden = true; });
}

async function loadPortfolio() {
  const lists = [...document.querySelectorAll('.project-list')];
  if (!lists.length) return;
  let payload;
  try {
    const response = await fetch(`${API_BASE}/api/portfolio`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Portfolio API unavailable');
    payload = await response.json();
  } catch {
    const fallback = await fetch(siteUrl('/assets/cms/portfolio.json'), { cache: 'no-store' });
    if (!fallback.ok) return;
    payload = await fallback.json();
  }
  const published = (payload.projects || []).filter(project => project.published !== false);
  lists.forEach(list => {
    const isHome = Boolean(list.closest('#home-featured'));
    const projects = isHome ? published.filter(project => project.featured).slice(0, 4) : published;
    applyProjects(list, projects);
  });
  window.dispatchEvent(new Event('resize'));
}

function contactMarkup() {
  return `<div class="cms-contact-modal" id="cms-contact-modal" aria-hidden="true">
    <div class="cms-contact-backdrop" data-close-contact></div>
    <section class="cms-contact-panel" role="dialog" aria-modal="true" aria-labelledby="cms-contact-title">
      <div class="cms-contact-top"><div><p class="cms-contact-kicker">Start a conversation</p><h2 class="cms-contact-title" id="cms-contact-title">Tell us about<br>your project</h2></div><button class="cms-contact-close" type="button" aria-label="Close" data-close-contact>×</button></div>
      <form class="cms-contact-grid" id="cms-contact-form">
        <div class="cms-field"><label for="cms-name">Name</label><input id="cms-name" name="name" required maxlength="80" autocomplete="name"></div>
        <div class="cms-field"><label for="cms-email">Email</label><input id="cms-email" name="email" type="email" required maxlength="160" autocomplete="email"></div>
        <div class="cms-field"><label for="cms-company">Company</label><input id="cms-company" name="company" maxlength="120" autocomplete="organization"></div>
        <div class="cms-field"><label for="cms-phone">Phone</label><input id="cms-phone" name="phone" maxlength="40" autocomplete="tel"></div>
        <div class="cms-field is-wide"><label for="cms-service">What can we help with?</label><select id="cms-service" name="service"><option>Website Development</option><option>Custom Software</option><option>UI/UX Design</option><option>Digital Marketing</option><option>Other</option></select></div>
        <div class="cms-field is-wide"><label for="cms-message">Project details</label><textarea id="cms-message" name="message" required maxlength="3000" placeholder="Goals, timeline, and anything useful to know"></textarea></div>
        <label class="cms-honeypot">Website<input name="website" tabindex="-1" autocomplete="off"></label>
        <button class="cms-contact-submit" type="submit">Send inquiry</button><p class="cms-contact-status" id="cms-contact-status" aria-live="polite"></p>
      </form>
    </section>
  </div>`;
}

function setupContactForm() {
  document.body.insertAdjacentHTML('beforeend', contactMarkup());
  const modal = document.querySelector('#cms-contact-modal');
  const form = document.querySelector('#cms-contact-form');
  const status = document.querySelector('#cms-contact-status');
  let previousFocus = null;

  const open = (email = '') => {
    previousFocus = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    if (email) form.elements.email.value = email;
    setTimeout(() => form.elements.name.focus(), 0);
  };
  const close = () => {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    previousFocus?.focus?.();
  };
  document.querySelectorAll('[data-close-contact]').forEach(button => button.addEventListener('click', close));
  document.addEventListener('keydown', event => {
    if (!modal.classList.contains('is-open')) return;
    if (event.key === 'Escape') close();
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button, input, select, textarea, a[href]')].filter(element => !element.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.querySelectorAll('a[href^="mailto:technexa@"], #end-section-title-link').forEach(link => link.addEventListener('click', event => { event.preventDefault(); open(); }));
  ['#header-menu-newsletter-form', '#footer-newsletter-form'].forEach(selector => {
    document.querySelectorAll(selector).forEach(emailForm => emailForm.addEventListener('submit', event => {
      event.preventDefault();
      open(emailForm.querySelector('input[type="email"]')?.value || '');
    }));
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    status.className = 'cms-contact-status';
    status.textContent = 'Sending…';
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    const payload = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch(`${API_BASE}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || 'Could not send your inquiry.');
        error.status = response.status;
        throw error;
      }
      form.reset();
      status.className = 'cms-contact-status is-success';
      status.textContent = 'Thank you — your inquiry is now in our project queue.';
    } catch (error) {
      status.className = 'cms-contact-status is-error';
      if (error.status && error.status < 500) {
        status.textContent = error.message;
      } else {
        const subject = encodeURIComponent(`Project inquiry from ${payload.name || payload.email}`);
        const body = encodeURIComponent(`Name: ${payload.name}\nEmail: ${payload.email}\nCompany: ${payload.company || '-'}\nPhone: ${payload.phone || '-'}\nService: ${payload.service || '-'}\n\n${payload.message || ''}`);
        const fallback = document.createElement('a');
        fallback.href = `mailto:technexa@technexasolutions.in?subject=${subject}&body=${body}`;
        fallback.textContent = 'Email us instead';
        status.replaceChildren('The admin inbox is temporarily unavailable. ', fallback, '.');
      }
    } finally {
      submit.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
}

setupContactForm();
loadPortfolio().catch(() => {});
