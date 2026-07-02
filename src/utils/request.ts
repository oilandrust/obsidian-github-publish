import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';

/** Typed wrapper — contains requestUrl inference for community ESLint scans. */
export async function fetchUrl(params: RequestUrlParam): Promise<RequestUrlResponse> {
  const response: unknown = await requestUrl(params);
  return response as RequestUrlResponse;
}
