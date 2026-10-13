function clean(value, max, required = false) {
  const result = String(value ?? '').trim().replace(/\u0000/g, '').slice(0, max);
  if (required && !result) throw Object.assign(new Error('Please complete all required fields.'), { status: 400 });
  return result;
}

function safeLocation(value, required = true) {
  const location = clean(value, 500, required);
  if (!location) return '';
  if (location.startsWith('/') && !location.startsWith('//')) return location;
  try {
    const url = new URL(location);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.href;
  } catch {
    throw Object.assign(new Error('Project and image URLs must be HTTPS links or root-relative paths.'), { status: 400 });
  }
}

export function validatePortfolio(input) {
  if (!Array.isArray(input?.projects) || input.projects.length > 50) throw Object.assign(new Error('Portfolio must contain between 0 and 50 projects.'), { status: 400 });
  const ids = new Set();
  const projects = input.projects.map((project, index) => {
    const fallbackId = `project-${index + 1}`;
    const id = clean(project.id || fallbackId, 80, true).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || fallbackId;
    if (ids.has(id)) throw Object.assign(new Error(`Duplicate project id: ${id}`), { status: 400 });
    ids.add(id);
    return {
      id,
      title: clean(project.title, 100, true),
      category: clean(project.category, 60, true),
      year: clean(project.year, 12, true),
      description: clean(project.description, 1000),
      image: safeLocation(project.image),
      url: safeLocation(project.url),
      featured: Boolean(project.featured),
      published: Boolean(project.published),
    };
  });
  return { updatedAt: new Date().toISOString(), projects };
}

export function validateInquiry(input) {
  if (clean(input?.website, 200)) throw Object.assign(new Error('Submission rejected.'), { status: 400 });
  const email = clean(input?.email, 160, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
  return {
    name: clean(input?.name, 80, true),
    email,
    company: clean(input?.company, 120),
    phone: clean(input?.phone, 40),
    service: clean(input?.service, 80),
    message: clean(input?.message, 3000, true),
  };
}

export function validateInquiryStatus(value) {
  const status = clean(value, 20, true).toLowerCase();
  if (!['new', 'read', 'contacted', 'closed'].includes(status)) throw Object.assign(new Error('Invalid inquiry status.'), { status: 400 });
  return status;
}
