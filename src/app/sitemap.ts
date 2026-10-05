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

  // Use type assertion to bypass strict generic inference
  const collectionsResponse = (await mockShopifyFetch({
    query: 'query getCollections'
  })) as {
    body: { data: { collections: { edges: { node: { handle: string; updatedAt: string } }[] }[] } };
  };

  const collections =
    collectionsResponse.body?.data?.collections?.edges?.map((edge) => edge.node) || [];

  const collectionsPromise = collections.map((collection) => ({
    url: `${baseUrl}/collections/${collection.handle}`,
    lastModified: collection.updatedAt
  }));

  const productsResponse = (await mockShopifyFetch({
    query: 'query getProducts',
    variables: { query: '' }
  })) as {
    body: { data: { products: { edges: { node: { handle: string; updatedAt: string } }[] }[] } };
  };

  const products = productsResponse.body?.data?.products?.edges?.map((edge) => edge.node) || [];

  const productsPromise = products.map((product) => ({
    url: `${baseUrl}/product/${product.handle}`,
    lastModified: product.updatedAt
  }));

  const pagesResponse = (await mockShopifyFetch({
    query: 'query getPages'
  })) as { body: { data: { pages: { handle: string; updatedAt: string }[] }[] } };

  const pages = pagesResponse.body?.data?.pages || [];

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
