const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!data.status) {
    throw new Error(data.message || 'API error');
  }
  return data.data;
}

// Auth
export async function registerUser(userData: any) {
  return fetchJSON('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function loginUser(regNumber: string) {
  return fetchJSON('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ regNumber }),
  });
}

// Banks
export async function getBanks() {
  return fetchJSON<{ id: number; name: string; code: string; slug: string }[]>('/banks');
}

// Products
export async function getProducts() {
  return fetchJSON<any[]>('/products');
}

export async function createProduct(product: any) {
  return fetchJSON('/products', {
    method: 'POST',
    body: JSON.stringify(product),
  });
}

// Seller Subaccount
export async function createSubaccount(data: { userId: string; businessName: string; bankCode: string; accountNumber: string }) {
  return fetchJSON<{ subaccountCode: string }>('/sellers/subaccount', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Payments
export async function initializePayment(data: { buyerId: string; productId: string; email: string }) {
  return fetchJSON<{
    authorization_url: string;
    access_code: string;
    reference: string;
    orderId: string;
  }>('/payments/initialize', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function verifyPayment(reference: string) {
  return fetchJSON(`/payments/verify/${reference}`);
}

// Orders
export async function getBuyerOrders(buyerId: string) {
  return fetchJSON<any[]>(`/orders/buyer/${buyerId}`);
}

export async function getSellerOrders(sellerId: string) {
  return fetchJSON<any[]>(`/orders/seller/${sellerId}`);
}

export async function getOrder(orderId: string) {
  return fetchJSON(`/orders/${orderId}`);
}

export async function updateOrderStatus(orderId: string, status: string) {
  return fetchJSON(`/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Refunds
export async function createRefund(orderId: string, amount?: number) {
  return fetchJSON('/refunds', {
    method: 'POST',
    body: JSON.stringify({ orderId, amount }),
  });
}

// Health
export async function getHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}
