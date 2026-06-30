import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';

/** Typed wrapper — contains requestUrl inference for community ESLint scans. */
export async function fetchUrl(params: RequestUrlParam): Promise<RequestUrlResponse> {
  return (await requestUrl(params)) as RequestUrlResponse;
}
