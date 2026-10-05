import { ReadonlyURLSearchParams } from 'next/navigation';

export const createUrl = (pathname: string, params: URLSearchParams | ReadonlyURLSearchParams) => {
  const paramsString = params.toString();
  const queryString = `${paramsString.length ? '?' : ''}${paramsString}`;

  return `${pathname}${queryString}`;
};

export const ensureStartsWith = (stringToCheck: string, startsWith: string) =>
  stringToCheck.startsWith(startsWith) ? stringToCheck : `${startsWith}${stringToCheck}`;

export const validateEnvironmentVariables = () => {
  // Mock mode - no environment variables required
  // Previously required: SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_ACCESS_TOKEN
};

// from https://stackoverflow.com/a/31615643
export const getNumberWithOrdinal = (n: number): string => {
  var s = ['th', 'st', 'nd', 'rd'],
    v = n % 100;
  return String(n) + (s[(v - 20) % 10] || s[v] || s[0]);
};
