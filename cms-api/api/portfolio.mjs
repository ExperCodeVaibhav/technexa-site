import { defaultPortfolio } from '../lib/defaults.mjs';
import { errorResponse, json, options, readJson, requireAdmin, requireOrigin } from '../lib/http.mjs';
import { PORTFOLIO_PATH, readRecord, writeRecord } from '../lib/storage.mjs';
import { validatePortfolio } from '../lib/validate.mjs';

export function OPTIONS(request) {
  return options(request);
}

export async function GET(request) {
  try {
    requireOrigin(request);
    const portfolio = await readRecord(PORTFOLIO_PATH) || defaultPortfolio;
    return json(request, portfolio, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PUT(request) {
  try {
    requireOrigin(request);
    requireAdmin(request);
    const portfolio = validatePortfolio(await readJson(request));
    await writeRecord(PORTFOLIO_PATH, portfolio);
    return json(request, portfolio, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return errorResponse(request, error);
  }
}
