export type FetchFn = (
  url: RequestInfo,
  init?: RequestInit
) => Promise<Response>;

export const fetch: FetchFn = async (url, init) => {
  return await fetchFn!(url, init);
};

let fetchFn: FetchFn = global.fetch;

export const setFetchFn = (fn: FetchFn) => {
  fetchFn = fn;
};
