import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';
import { callFn } from './call';

export interface UrlResponse {
  status: number;
  text: string;
}

function toUrlResponse(raw: unknown): UrlResponse {
  const response = raw as RequestUrlResponse;
  return {
    status: response.status as number,
    text: response.text as string,
  };
}

/** Typed wrapper — contains requestUrl inference for community ESLint scans. */
export async function fetchUrl(params: RequestUrlParam): Promise<UrlResponse> {
  const raw: unknown = await callFn(requestUrl, params);
  return toUrlResponse(raw);
}
