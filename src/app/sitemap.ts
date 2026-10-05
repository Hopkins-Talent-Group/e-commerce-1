import { mockShopifyFetch } from '@/lib/shopify/mock';
import type { MetadataRoute } from 'next';

type Route = {
  url: string;
  lastModified: string;
};

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? 'https://clothing-store.rashidshamloo.com'
  : 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routesMap = [''].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString()
  }));

  const collections =
    (
      await mockShopifyFetch<{
        body: {
          data: {
            collections: {
              edges: {
                node: {
                  handle: string;
                  updatedAt: string;
                }[];
              };
            };
          };
        };
      }>({
        query: 'query getCollections'
      })
    ).body?.data?.collections?.edges?.map((edge) => edge.node) || [];

  const collectionsPromise = collections.map((collection) => ({
    url: `${baseUrl}/collections/${collection.handle}`,
    lastModified: collection.updatedAt
  }));

  const products =
    (
      await mockShopifyFetch<{
        body: {
          data: {
            products: {
              edges: {
                node: {
                  handle: string;
                  updatedAt: string;
                }[];
              };
            };
          };
        };
      }>({
        query: 'query getProducts',
        variables: { query: '' }
      })
    ).body?.data?.products?.edges?.map((edge) => edge.node) || [];

  const productsPromise = products.map((product) => ({
    url: `${baseUrl}/product/${product.handle}`,
    lastModified: product.updatedAt
  }));

  const pages =
    (
      await mockShopifyFetch<{
        body: {
          data: {
            pages: {
              handle: string;
              updatedAt: string;
            }[];
          };
        };
      }>({
        query: 'query getPages'
      })
    ).body?.data?.pages || [];

  const pagesPromise = pages.map((page) => ({
    url: `${baseUrl}/pages/${page.handle}`,
    lastModified: page.updatedAt
  }));

  let fetchedRoutes: Route[] = [];

  try {
    fetchedRoutes = (await Promise.all([collectionsPromise, productsPromise, pagesPromise])).flat();
  } catch (error) {
    console.error('Sitemap generation error:', error);
    fetchedRoutes = [];
  }

  return [...routesMap, ...fetchedRoutes];
}
