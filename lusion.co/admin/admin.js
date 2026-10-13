const API_BASE = 'https://technexa-cms-api.vercel.app';
const SITE_MARKER = '/admin/admin.js';
const modulePath = new URL(import.meta.url).pathname;
const SITE_BASE = modulePath.endsWith(SITE_MARKER) ? modulePath.slice(0, -SITE_MARKER.length) : '';
const state = { key: sessionStorage.getItem('technexa-admin-key') || '', projects: [], inquiries: [] };

const $ = selector => document.querySelector(selector);
const loginView = $('#login-view');
const dashboard = $('#dashboard');
const connection = $('#connection');
const logout = $('#logout');
const projectEditor = $('#project-editor');
const inquiryList = $('#inquiry-list');
const template = $('#project-template');

function request(path, options = {}) {
  return fetch(`${API_BASE}${path}`, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': state.key, ...(options.headers || {}) } }).then(async response => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  });
}

function resolveImage(value) {
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${location.origin}${SITE_BASE}${path}`;
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || `project-${Date.now()}`;
}

function showStatus(element, message, type = '') {
  element.className = `form-status ${type}`.trim();
  element.textContent = message;
}

function readProjectCard(card, fallbackId) {
  const get = name => card.querySelector(`[name="${name}"]`);
  return {
    id: card.dataset.id || slugify(get('title').value) || fallbackId,
    title: get('title').value.trim(),
    category: get('category').value.trim(),
    year: get('year').value.trim(),
    image: get('image').value.trim(),
    url: get('url').value.trim(),
    description: get('description').value.trim(),
    featured: get('featured').checked,
    published: get('published').checked,
  };
}

function renderProjects() {
  projectEditor.innerHTML = '';
  state.projects.forEach((project, index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = project.id;
    const set = (name, value) => {
      const field = card.querySelector(`[name="${name}"]`);
      if (field.type === 'checkbox') field.checked = Boolean(value);
      else field.value = value || '';
    };
    ['title', 'category', 'year', 'image', 'url', 'description', 'featured', 'published'].forEach(name => set(name, project[name]));
    card.querySelector('.project-number').textContent = String(index + 1).padStart(2, '0');
    const preview = card.querySelector('img');
    preview.src = resolveImage(project.image || '');
    preview.alt = project.title || 'Project preview';
    card.querySelector('[name="image"]').addEventListener('change', event => { preview.src = resolveImage(event.target.value); });
    card.querySelector('[data-move="up"]').disabled = index === 0;
    card.querySelector('[data-move="down"]').disabled = index === state.projects.length - 1;
    card.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => {
      const target = index + (button.dataset.move === 'up' ? -1 : 1);
      [state.projects[index], state.projects[target]] = [state.projects[target], state.projects[index]];
      renderProjects();
    }));
    card.querySelector('[data-remove]').addEventListener('click', () => {
      if (!window.confirm(`Remove “${project.title || 'this project'}” from the portfolio?`)) return;
      state.projects.splice(index, 1);
      renderProjects();
    });
    projectEditor.append(card);
  });
  $('#project-count').textContent = state.projects.length;
}

function inquiryHtml(inquiry) {
  const article = document.createElement('article');
  article.className = 'inquiry-card';
  const identity = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = inquiry.name;
  const email = document.createElement('a');
  email.href = `mailto:${inquiry.email}`;
  email.textContent = inquiry.email;
  const details = document.createElement('p');
  details.className = 'inquiry-meta';
  details.textContent = [inquiry.company, inquiry.phone, inquiry.service].filter(Boolean).join(' · ');
  identity.append(title, email, details);
  const body = document.createElement('div');
  const message = document.createElement('p');
  message.className = 'inquiry-message';
  message.textContent = inquiry.message;
  const date = document.createElement('p');
  date.className = 'inquiry-meta';
  date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(inquiry.createdAt));
  body.append(message, date);
  const select = document.createElement('select');
  ['new', 'read', 'contacted', 'closed'].forEach(status => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status[0].toUpperCase() + status.slice(1);
    option.selected = inquiry.status === status;
    select.append(option);
  });
  select.setAttribute('aria-label', `Status for ${inquiry.name}`);
  select.addEventListener('change', async () => {
    select.disabled = true;
    try {
      await request('/api/inquiries', { method: 'PATCH', body: JSON.stringify({ id: inquiry.id, status: select.value }) });
      inquiry.status = select.value;
      showStatus($('#inquiry-status'), 'Inquiry status updated.', 'success');
    } catch (error) {
      select.value = inquiry.status;
      showStatus($('#inquiry-status'), error.message, 'error');
    } finally { select.disabled = false; }
  });
  article.append(identity, body, select);
  return article;
}

function renderInquiries() {
  inquiryList.innerHTML = '';
  if (!state.inquiries.length) inquiryList.innerHTML = '<div class="empty">No inquiries yet.</div>';
  state.inquiries.forEach(inquiry => inquiryList.append(inquiryHtml(inquiry)));
  $('#inquiry-count').textContent = state.inquiries.filter(item => item.status === 'new').length;
}

async function loadDashboard() {
  connection.textContent = 'Connecting…';
  const [portfolio, inquiries] = await Promise.all([request('/api/portfolio'), request('/api/inquiries')]);
  state.projects = portfolio.projects || [];
  state.inquiries = inquiries.inquiries || [];
  renderProjects();
  renderInquiries();
  loginView.hidden = true;
  dashboard.hidden = false;
  logout.hidden = false;
  connection.textContent = 'Live data connected';
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  state.key = $('#admin-key').value.trim();
  showStatus($('#login-status'), 'Checking access…');
  try {
    await loadDashboard();
    sessionStorage.setItem('technexa-admin-key', state.key);
  } catch (error) {
    state.key = '';
    showStatus($('#login-status'), error.message, 'error');
    connection.textContent = 'Access denied';
  }
});

logout.addEventListener('click', () => {
  sessionStorage.removeItem('technexa-admin-key');
  state.key = '';
  dashboard.hidden = true;
  logout.hidden = true;
  loginView.hidden = false;
  connection.textContent = 'Not connected';
  $('#admin-key').value = '';
});

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(item => item.classList.toggle('is-active', item === tab));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('is-active', panel.id === `${tab.dataset.tab}-panel`));
}));

$('#add-project').addEventListener('click', () => {
  state.projects.push({ id: `project-${Date.now()}`, title: 'New Project', category: 'Website', year: String(new Date().getFullYear()), description: '', image: '/assets/projects/oryzo_ai/home.webp', url: '#', featured: false, published: false });
  renderProjects();
  projectEditor.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

$('#save-projects').addEventListener('click', async () => {
  const status = $('#project-status');
  try {
    state.projects = [...projectEditor.querySelectorAll('.project-card')].map((card, index) => readProjectCard(card, `project-${index + 1}`));
    showStatus(status, 'Publishing portfolio…');
    const saved = await request('/api/portfolio', { method: 'PUT', body: JSON.stringify({ projects: state.projects }) });
    state.projects = saved.projects;
    renderProjects();
    showStatus(status, 'Portfolio published. The live site will show the update immediately.', 'success');
  } catch (error) { showStatus(status, error.message, 'error'); }
});

$('#refresh-inquiries').addEventListener('click', async () => {
  try {
    const payload = await request('/api/inquiries');
    state.inquiries = payload.inquiries || [];
    renderInquiries();
    showStatus($('#inquiry-status'), 'Inquiries refreshed.', 'success');
  } catch (error) { showStatus($('#inquiry-status'), error.message, 'error'); }
});

if (state.key) loadDashboard().catch(() => { sessionStorage.removeItem('technexa-admin-key'); state.key = ''; });
