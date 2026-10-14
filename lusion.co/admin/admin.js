const API_BASE = (document.querySelector('meta[name="technexa-cms-api"]')?.content || 'https://technexa-cms-api.vercel.app').replace(/\/$/, '');
const SITE_MARKER = '/admin/admin.js';
const modulePath = new URL(import.meta.url).pathname;
const SITE_BASE = modulePath.endsWith(SITE_MARKER) ? modulePath.slice(0, -SITE_MARKER.length) : '';
const state = {
  username: sessionStorage.getItem('technexa-admin-username') || '',
  password: sessionStorage.getItem('technexa-admin-password') || '',
  projects: [],
  inquiries: [],
  dirty: false,
};

const $ = selector => document.querySelector(selector);
const loginView = $('#login-view');
const dashboard = $('#dashboard');
const connection = $('#connection');
const logout = $('#logout');
const projectEditor = $('#project-editor');
const inquiryList = $('#inquiry-list');
const template = $('#project-template');
const saveProjects = $('#save-projects');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(state.username && state.password ? {
        'X-Admin-Username': state.username,
        'X-Admin-Password': state.password,
      } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function resolveImage(value) {
  if (!value) return '';
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

function setBusy(button, busy, busyLabel) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
    delete button.dataset.label;
  }
  button.disabled = busy;
}

function setDirty(dirty = true) {
  state.dirty = dirty;
  saveProjects.textContent = dirty ? 'Publish changes •' : 'Publish changes';
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

function syncProjectsFromEditor() {
  state.projects = [...projectEditor.querySelectorAll('.project-card')].map((card, index) => readProjectCard(card, `project-${index + 1}`));
}

function validateProjectFields() {
  const fields = [...projectEditor.querySelectorAll('[required]')];
  const invalid = fields.find(field => !field.checkValidity());
  if (!invalid) return true;
  invalid.reportValidity();
  invalid.focus();
  return false;
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
    preview.src = resolveImage(project.image);
    preview.alt = project.title || 'Project preview';
    preview.addEventListener('error', () => preview.classList.add('is-missing'));
    preview.addEventListener('load', () => preview.classList.remove('is-missing'));
    card.querySelectorAll('input, textarea').forEach(field => field.addEventListener('input', () => setDirty()));
    card.querySelectorAll('input[type="checkbox"]').forEach(field => field.addEventListener('change', () => setDirty()));
    card.querySelector('[name="image"]').addEventListener('input', event => {
      preview.src = resolveImage(event.target.value.trim());
      preview.alt = card.querySelector('[name="title"]').value.trim() || 'Project preview';
    });
    card.querySelector('[name="title"]').addEventListener('input', event => {
      preview.alt = event.target.value.trim() || 'Project preview';
    });
    card.querySelector('[data-move="up"]').disabled = index === 0;
    card.querySelector('[data-move="down"]').disabled = index === state.projects.length - 1;
    card.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => {
      syncProjectsFromEditor();
      const target = index + (button.dataset.move === 'up' ? -1 : 1);
      [state.projects[index], state.projects[target]] = [state.projects[target], state.projects[index]];
      setDirty();
      renderProjects();
    }));
    card.querySelector('[data-remove]').addEventListener('click', () => {
      syncProjectsFromEditor();
      if (!window.confirm(`Remove “${state.projects[index].title || 'this project'}” from the portfolio?`)) return;
      state.projects.splice(index, 1);
      setDirty();
      renderProjects();
    });
    projectEditor.append(card);
  });
  $('#project-count').textContent = state.projects.length;
}

function inquiryMatches(inquiry) {
  const status = $('#inquiry-filter').value;
  const query = $('#inquiry-search').value.trim().toLowerCase();
  if (status !== 'all' && inquiry.status !== status) return false;
  if (!query) return true;
  return [inquiry.name, inquiry.email, inquiry.company, inquiry.phone, inquiry.service, inquiry.message]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(query));
}

function inquiryHtml(inquiry) {
  const article = document.createElement('article');
  article.className = 'inquiry-card';
  article.dataset.status = inquiry.status;

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

  const actions = document.createElement('div');
  actions.className = 'inquiry-actions';
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
    const previous = inquiry.status;
    try {
      await request('/api/inquiries', { method: 'PATCH', body: JSON.stringify({ id: inquiry.id, status: select.value }) });
      inquiry.status = select.value;
      showStatus($('#inquiry-status'), 'Inquiry status updated.', 'success');
      renderInquiries();
    } catch (error) {
      select.value = previous;
      showStatus($('#inquiry-status'), error.message, 'error');
    } finally {
      select.disabled = false;
    }
  });
  const reply = document.createElement('a');
  reply.className = 'inquiry-action-link';
  reply.href = `mailto:${inquiry.email}?subject=${encodeURIComponent(`Re: ${inquiry.service || 'Your project inquiry'}`)}`;
  reply.textContent = 'Reply';
  const remove = document.createElement('button');
  remove.className = 'inquiry-delete';
  remove.type = 'button';
  remove.textContent = 'Delete';
  remove.addEventListener('click', async () => {
    if (!window.confirm(`Permanently delete the inquiry from ${inquiry.name}?`)) return;
    setBusy(remove, true, 'Deleting…');
    try {
      await request('/api/inquiries', { method: 'DELETE', body: JSON.stringify({ id: inquiry.id }) });
      state.inquiries = state.inquiries.filter(item => item.id !== inquiry.id);
      renderInquiries();
      showStatus($('#inquiry-status'), 'Inquiry deleted.', 'success');
    } catch (error) {
      showStatus($('#inquiry-status'), error.message, 'error');
      setBusy(remove, false);
    }
  });
  actions.append(select, reply, remove);
  article.append(identity, body, actions);
  return article;
}

function renderInquiries() {
  inquiryList.innerHTML = '';
  const visible = state.inquiries.filter(inquiryMatches);
  if (!visible.length) inquiryList.innerHTML = '<div class="empty">No inquiries match this view.</div>';
  visible.forEach(inquiry => inquiryList.append(inquiryHtml(inquiry)));
  const newCount = state.inquiries.filter(item => item.status === 'new').length;
  $('#inquiry-count').textContent = newCount;
  $('#inquiry-summary').textContent = `${visible.length} shown · ${state.inquiries.length} total · ${newCount} new`;
  $('#export-inquiries').disabled = state.inquiries.length === 0;
}

async function loadDashboard() {
  connection.textContent = 'Connecting…';
  const [portfolio, inquiries] = await Promise.all([request('/api/portfolio'), request('/api/inquiries')]);
  state.projects = portfolio.projects || [];
  state.inquiries = inquiries.inquiries || [];
  renderProjects();
  renderInquiries();
  setDirty(false);
  loginView.hidden = true;
  dashboard.hidden = false;
  logout.hidden = false;
  connection.textContent = 'Live data connected';
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  state.username = $('#admin-username').value.trim();
  state.password = $('#admin-password').value;
  showStatus($('#login-status'), 'Checking access…');
  setBusy(submit, true, 'Connecting…');
  try {
    await loadDashboard();
    sessionStorage.setItem('technexa-admin-username', state.username);
    sessionStorage.setItem('technexa-admin-password', state.password);
    showStatus($('#login-status'), '');
  } catch (error) {
    state.password = '';
    showStatus($('#login-status'), error.message, 'error');
    connection.textContent = 'Access denied';
  } finally {
    setBusy(submit, false);
  }
});

logout.addEventListener('click', () => {
  if (state.dirty && !window.confirm('Discard your unpublished portfolio changes and log out?')) return;
  sessionStorage.removeItem('technexa-admin-username');
  sessionStorage.removeItem('technexa-admin-password');
  state.username = '';
  state.password = '';
  setDirty(false);
  dashboard.hidden = true;
  logout.hidden = true;
  loginView.hidden = false;
  connection.textContent = 'Not connected';
  $('#admin-username').value = '';
  $('#admin-password').value = '';
});

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(item => item.classList.toggle('is-active', item === tab));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('is-active', panel.id === `${tab.dataset.tab}-panel`));
}));

$('#add-project').addEventListener('click', () => {
  syncProjectsFromEditor();
  state.projects.push({
    id: `project-${Date.now()}`,
    title: 'New Project',
    category: 'Website',
    year: String(new Date().getFullYear()),
    description: '',
    image: '/assets/projects/oryzo_ai/home.webp',
    url: '/projects',
    featured: false,
    published: false,
  });
  setDirty();
  renderProjects();
  projectEditor.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  projectEditor.lastElementChild?.querySelector('[name="title"]')?.select();
});

saveProjects.addEventListener('click', async () => {
  const status = $('#project-status');
  if (!validateProjectFields()) {
    showStatus(status, 'Complete the required project fields before publishing.', 'error');
    return;
  }
  try {
    syncProjectsFromEditor();
    setBusy(saveProjects, true, 'Publishing…');
    showStatus(status, 'Publishing portfolio…');
    const saved = await request('/api/portfolio', { method: 'PUT', body: JSON.stringify({ projects: state.projects }) });
    state.projects = saved.projects;
    renderProjects();
    setDirty(false);
    showStatus(status, 'Portfolio published. The live site will show the update immediately.', 'success');
  } catch (error) {
    showStatus(status, error.message, 'error');
  } finally {
    setBusy(saveProjects, false);
    saveProjects.textContent = state.dirty ? 'Publish changes •' : 'Publish changes';
  }
});

$('#refresh-inquiries').addEventListener('click', async event => {
  const button = event.currentTarget;
  setBusy(button, true, 'Refreshing…');
  try {
    const payload = await request('/api/inquiries');
    state.inquiries = payload.inquiries || [];
    renderInquiries();
    showStatus($('#inquiry-status'), 'Inquiries refreshed.', 'success');
  } catch (error) {
    showStatus($('#inquiry-status'), error.message, 'error');
  } finally {
    setBusy(button, false);
  }
});

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

$('#export-inquiries').addEventListener('click', () => {
  const columns = ['createdAt', 'name', 'email', 'company', 'phone', 'service', 'message', 'status'];
  const rows = [columns, ...state.inquiries.map(inquiry => columns.map(column => inquiry[column] || ''))];
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `technexa-inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

$('#inquiry-filter').addEventListener('change', renderInquiries);
$('#inquiry-search').addEventListener('input', renderInquiries);
window.addEventListener('beforeunload', event => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

if (state.username && state.password) {
  loadDashboard().catch(error => {
    sessionStorage.removeItem('technexa-admin-username');
    sessionStorage.removeItem('technexa-admin-password');
    state.username = '';
    state.password = '';
    connection.textContent = 'Session expired';
    showStatus($('#login-status'), error.message, 'error');
  });
}
