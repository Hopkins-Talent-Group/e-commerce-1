import mockData from '@/data/mock-shopify.json';
import { cookies } from 'next/headers';
import type {
  CartItem,
  Image,
  Page,
  Product,
  ProductVariant,
  ShopifyCart,
  ShopifyCollection,
  ShopifyProduct
} from './types';

interface RawImage {
  url: string;
  altText: string | null;
  width: number;
  height: number;
}

interface RawVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
  price: { amount: string; currencyCode: string };
  image: { originalSrc: string };
}

interface RawProduct {
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  minPrice: string;
  maxPrice: string;
  currencyCode: string;
  options: { name: string; values: string[] }[];
  images: RawImage[];
  variants: RawVariant[];
  tags: string[];
  seo: { title: string; description: string };
  updatedAt: string;
}

interface RawCollection {
  handle: string;
  title: string;
  description: string;
  products: string[];
}

interface RawPage {
  handle: string;
  title: string;
  body: string;
  bodySummary: string;
  updatedAt: string;
  createdAt: string;
}

interface RawCatalog {
  products: RawProduct[];
  collections: RawCollection[];
  pages: RawPage[];
}

const catalog = mockData as unknown as RawCatalog;

const DEFAULT_IMAGE: Image = {
  url: '/images/logo.png',
  altText: 'Rumusha',
  width: 512,
  height: 512
};

function buildImages(product: RawProduct): Image[] {
  return product.images.map((image) => ({
    url: image.url,
    altText: image.altText || product.title,
    width: image.width,
    height: image.height
  }));
}

function buildVariants(product: RawProduct, images: Image[]): ProductVariant[] {
  if (product.variants.length) {
    return product.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      availableForSale: variant.availableForSale,
      selectedOptions: variant.selectedOptions,
      price: variant.price,
      image: variant.image
    }));
  }

  return [
    {
      id: `gid://shopify/ProductVariant/mock-${product.handle}`,
      title: 'Default Title',
      availableForSale: true,
      selectedOptions: [],
      price: { amount: product.minPrice, currencyCode: product.currencyCode },
      image: { originalSrc: images[0]?.url || DEFAULT_IMAGE.url }
    }
  ];
}

const products: ShopifyProduct[] = catalog.products.map((raw) => {
  const images = buildImages(raw);
  const variants = buildVariants(raw, images);

  return {
    id: `gid://shopify/Product/mock-${raw.handle}`,
    handle: raw.handle,
    availableForSale: true,
    title: raw.title,
    description: raw.description,
    descriptionHtml: raw.descriptionHtml || `<p>${raw.description}</p>`,
    options: raw.options.map((option, index) => ({
      id: `gid://shopify/ProductOption/mock-${raw.handle}-${index}`,
      name: option.name,
      values: option.values
    })),
    priceRange: {
      maxVariantPrice: { amount: raw.maxPrice, currencyCode: raw.currencyCode },
      minVariantPrice: { amount: raw.minPrice, currencyCode: raw.currencyCode }
    },
    variants: { edges: variants.map((node) => ({ node })) },
    featuredImage: images[0] || DEFAULT_IMAGE,
    images: { edges: images.map((node) => ({ node })) },
    seo: { title: raw.seo.title || raw.title, description: raw.seo.description || raw.description },
    tags: raw.tags,
    updatedAt: raw.updatedAt
  };
});

const collections: ShopifyCollection[] = catalog.collections.map((raw) => ({
  handle: raw.handle,
  title: raw.title,
  description: raw.description,
  seo: { title: raw.title, description: raw.description },
  updatedAt: '2024-01-01T00:00:00.000Z'
}));

const collectionMembers: Map<string, string[]> = new Map(
  catalog.collections.map((raw) => [raw.handle, raw.products])
);

const pages: Page[] = catalog.pages as unknown as Page[];

function storeDomain(): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN || '';
  if (!domain) return '';
  return domain.startsWith('https://') ? domain : `https://${domain}`;
}

function menuItems(): { title: string; url: string; items: { title: string; url: string }[] }[] {
  const domain = storeDomain();
  const link = (path: string) => `${domain}${path}`;

  return [
    { title: 'All Products', url: link('/collections/all-products'), items: [] },
    {
      title: 'Clothing',
      url: link('/collections/clothing'),
      items: [
        { title: 'Dresses', url: link('/collections/dresses') },
        { title: 'Tops', url: link('/collections/tops') },
        { title: 'Bottoms', url: link('/collections/bottoms') },
        { title: 'Outer', url: link('/collections/outer') }
      ]
    },
    { title: 'Bags', url: link('/collections/bags'), items: [] },
    { title: 'Shoes', url: link('/collections/shoes'), items: [] },
    { title: 'Accessories', url: link('/collections/accessories'), items: [] },
    { title: 'About Us', url: link('/pages/about-us'), items: [] }
  ];
}

function normalizeSearchTerm(query: unknown): string {
  if (typeof query !== 'string') return '';
  return query
    .toLowerCase()
    .replace(/["*]/g, '')
    .replace(/^title:/, '')
    .trim();
}

function matchesSearch(product: ShopifyProduct, term: string): boolean {
  if (!term) return true;
  if (product.title.toLowerCase().includes(term)) return true;
  if (product.description.toLowerCase().includes(term)) return true;
  return product.tags.some((tag) => tag.toLowerCase().includes(term));
}

function minPrice(product: ShopifyProduct): number {
  return parseFloat(product.priceRange.minVariantPrice.amount);
}

function sortProducts(
  list: ShopifyProduct[],
  sortKey: unknown,
  reverse: unknown
): ShopifyProduct[] {
  const sorted = [...list];
  const descending = reverse === true;

  if (sortKey === 'PRICE' || sortKey === 'PRICE_MIN') {
    sorted.sort((a, b) => minPrice(a) - minPrice(b));
  } else if (sortKey === 'CREATED_AT' || sortKey === 'CREATED') {
    sorted.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }

  if (descending) sorted.reverse();
  return sorted;
}

function queryProducts(variables: Record<string, unknown>): ShopifyProduct[] {
  const term = normalizeSearchTerm(variables.query);
  const filtered = products.filter((product) => matchesSearch(product, term));
  const sorted = sortProducts(filtered, variables.sortKey, variables.reverse);
  const first = typeof variables.first === 'number' ? variables.first : 100;
  return sorted.slice(0, first);
}

function queryCollectionProducts(variables: Record<string, unknown>): ShopifyProduct[] {
  const handle = typeof variables.handle === 'string' ? variables.handle : '';
  const members = collectionMembers.get(handle);
  if (!members) return [];

  const memberSet = new Set(members);
  const filtered = products.filter((product) => memberSet.has(product.handle));
  const sorted = sortProducts(filtered, variables.sortKey, variables.reverse);
  const first = typeof variables.first === 'number' ? variables.first : 100;
  return sorted.slice(0, first);
}

function queryRecommendations(variables: Record<string, unknown>): ShopifyProduct[] {
  const productId = typeof variables.productId === 'string' ? variables.productId : '';
  return products.filter((product) => product.id !== productId).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Mock cart — persisted in a cookie so it survives across edge/node runtimes.
// ---------------------------------------------------------------------------

const CART_COOKIE = 'mock-cart';

interface StoredLine {
  id: string;
  merchandiseId: string;
  quantity: number;
}

interface StoredCart {
  id: string;
  lines: StoredLine[];
}

function readCart(): StoredCart | null {
  try {
    const raw = cookies().get(CART_COOKIE)?.value;
    if (!raw) return null;
    const parsed = JSON.parse(decodeURIComponent(raw)) as StoredCart;
    if (!parsed || typeof parsed.id !== 'string' || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCart(cart: StoredCart): void {
  try {
    cookies().set(CART_COOKIE, encodeURIComponent(JSON.stringify(cart)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    });
  } catch (error) {
    console.warn('[shopify/mock] Unable to persist mock cart cookie:', error);
  }
}

function findVariant(
  merchandiseId: string
): { product: ShopifyProduct; variant: ProductVariant } | null {
  for (const product of products) {
    for (const edge of product.variants.edges) {
      const variant = edge.node;
      if (variant && variant.id === merchandiseId) {
        return { product, variant };
      }
    }
  }
  return null;
}

function buildShopifyCart(stored: StoredCart): ShopifyCart {
  const lines: CartItem[] = [];
  let subtotal = 0;
  let totalQuantity = 0;
  let currencyCode = 'JPY';

  for (const line of stored.lines) {
    const found = findVariant(line.merchandiseId);
    if (!found) continue;

    const { product, variant } = found;
    currencyCode = variant.price.currencyCode;
    const lineTotal = parseFloat(variant.price.amount) * line.quantity;
    subtotal += lineTotal;
    totalQuantity += line.quantity;

    lines.push({
      id: line.id,
      quantity: line.quantity,
      cost: {
        totalAmount: { amount: String(lineTotal), currencyCode }
      },
      merchandise: {
        id: variant.id,
        title: variant.title,
        selectedOptions: variant.selectedOptions,
        product: product as unknown as Product
      }
    });
  }

  return {
    id: stored.id,
    checkoutUrl: '#',
    cost: {
      subtotalAmount: { amount: String(subtotal), currencyCode },
      totalAmount: { amount: String(subtotal), currencyCode },
      totalTaxAmount: { amount: '0.0', currencyCode }
    },
    lines: { edges: lines.map((node) => ({ node })) },
    totalQuantity
  };
}

function newLineId(): string {
  return `mock-line-${Math.random().toString(36).slice(2, 10)}`;
}

function cartCreate(): ShopifyCart {
  const cart: StoredCart = { id: `mock://cart-${Date.now().toString(36)}`, lines: [] };
  writeCart(cart);
  return buildShopifyCart(cart);
}

function cartForMutation(cartId: string): StoredCart {
  const stored = readCart();
  if (stored && stored.id === cartId) return stored;
  return { id: cartId, lines: [] };
}

function cartLinesAdd(variables: Record<string, unknown>): ShopifyCart {
  const cartId = String(variables.cartId ?? '');
  const cart = cartForMutation(cartId);
  const incoming = Array.isArray(variables.lines) ? variables.lines : [];

  for (const entry of incoming as { merchandiseId?: string; quantity?: number }[]) {
    if (!entry?.merchandiseId) continue;
    const quantity = typeof entry.quantity === 'number' ? entry.quantity : 1;
    const existing = cart.lines.find((line) => line.merchandiseId === entry.merchandiseId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.lines.push({ id: newLineId(), merchandiseId: entry.merchandiseId, quantity });
    }
  }

  writeCart(cart);
  return buildShopifyCart(cart);
}

function cartLinesRemove(variables: Record<string, unknown>): ShopifyCart {
  const cartId = String(variables.cartId ?? '');
  const cart = cartForMutation(cartId);
  const lineIds = new Set(Array.isArray(variables.lineIds) ? (variables.lineIds as string[]) : []);
  cart.lines = cart.lines.filter((line) => !lineIds.has(line.id));
  writeCart(cart);
  return buildShopifyCart(cart);
}

function cartLinesUpdate(variables: Record<string, unknown>): ShopifyCart {
  const cartId = String(variables.cartId ?? '');
  const cart = cartForMutation(cartId);
  const incoming = Array.isArray(variables.lines) ? variables.lines : [];

  for (const entry of incoming as {
    id?: string;
    merchandiseId?: string;
    quantity?: number;
  }[]) {
    if (!entry?.id) continue;
    const quantity = typeof entry.quantity === 'number' ? entry.quantity : 0;
    const existing = cart.lines.find((line) => line.id === entry.id);
    if (existing) {
      existing.quantity = quantity;
      if (entry.merchandiseId) existing.merchandiseId = entry.merchandiseId;
    } else if (quantity > 0 && entry.merchandiseId) {
      cart.lines.push({ id: entry.id, merchandiseId: entry.merchandiseId, quantity });
    }
  }

  cart.lines = cart.lines.filter((line) => line.quantity > 0);
  writeCart(cart);
  return buildShopifyCart(cart);
}

function cartQuery(variables: Record<string, unknown>): ShopifyCart | null {
  const stored = readCart();
  if (!stored || stored.id !== String(variables.cartId ?? '')) return null;
  return buildShopifyCart(stored);
}

// ---------------------------------------------------------------------------
// GraphQL-style response dispatch
// ---------------------------------------------------------------------------

function edges<T>(nodes: T[]): { edges: { node: T }[] } {
  return { edges: nodes.map((node) => ({ node })) };
}

function buildBody(query: string, variables: Record<string, unknown>): unknown {
  if (query.includes('mutation createCart')) {
    return { data: { cartCreate: { cart: cartCreate() } } };
  }
  if (query.includes('cartLinesAdd')) {
    return { data: { cartLinesAdd: { cart: cartLinesAdd(variables) } } };
  }
  if (query.includes('cartLinesRemove')) {
    return { data: { cartLinesRemove: { cart: cartLinesRemove(variables) } } };
  }
  if (query.includes('cartLinesUpdate')) {
    return { data: { cartLinesUpdate: { cart: cartLinesUpdate(variables) } } };
  }
  if (query.includes('query getCart')) {
    return { data: { cart: cartQuery(variables) } };
  }
  if (query.includes('query getMenu')) {
    return { data: { menu: { items: menuItems() } } };
  }
  if (query.includes('query getCollectionProducts')) {
    const handle = typeof variables.handle === 'string' ? variables.handle : '';
    const collection = collections.find((item) => item.handle === handle);
    if (!collection) return { data: { collection: null } };
    return { data: { collection: { products: edges(queryCollectionProducts(variables)) } } };
  }
  if (query.includes('query getCollections')) {
    return { data: { collections: edges(collections) } };
  }
  if (query.includes('query getCollection(')) {
    const handle = typeof variables.handle === 'string' ? variables.handle : '';
    return { data: { collection: collections.find((item) => item.handle === handle) ?? null } };
  }
  if (query.includes('query getProductRecommendations')) {
    return { data: { productRecommendations: queryRecommendations(variables) } };
  }
  if (query.includes('query getProduct(')) {
    const handle = typeof variables.handle === 'string' ? variables.handle : '';
    return { data: { product: products.find((item) => item.handle === handle) ?? null } };
  }
  if (query.includes('query getProducts')) {
    return { data: { products: edges(queryProducts(variables)) } };
  }
  if (query.includes('query getPages')) {
    return { data: { pages: edges(pages) } };
  }
  if (query.includes('query getPage(')) {
    const handle = typeof variables.handle === 'string' ? variables.handle : '';
    return { data: { pageByHandle: pages.find((page) => page.handle === handle) ?? null } };
  }

  return { data: null };
}

export function mockShopifyFetch<T>({
  query,
  variables
}: {
  query: string;
  variables?: Record<string, unknown>;
}): { status: number; body: T } {
  return {
    status: 200,
    body: buildBody(query, variables ?? {}) as T
  };
}
