require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC = process.env.PAYSTACK_PUBLIC_KEY;
const PLATFORM_FEE_PERCENT = parseInt(process.env.PLATFORM_FEE_PERCENT || '10');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

if (!PAYSTACK_SECRET) {
  console.error('ERROR: PAYSTACK_SECRET_KEY is not set in .env file');
  process.exit(1);
}

// Middleware
app.use(cors({ origin: '*' }));
// Parse JSON for all routes EXCEPT webhook (webhook needs raw body for HMAC)
app.use((req, res, next) => {
  if (req.path === '/api/webhook') return next();
  express.json()(req, res, next);
});

// Paystack API helper
const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    'Content-Type': 'application/json',
  },
});

// ==================== BANKS ====================
app.get('/api/banks', async (req, res) => {
  try {
    // Try cache first
    const cached = await db.getBanks();
    if (cached.length > 0) {
      return res.json({ status: true, data: cached });
    }

    const response = await paystack.get('/bank?country=nigeria');
    const banks = response.data.data.map(b => ({
      id: b.id,
      name: b.name,
      code: b.code,
      slug: b.slug,
    }));
    await db.setBanks(banks);
    res.json({ status: true, data: banks });
  } catch (error) {
    console.error('Error fetching banks:', error.response?.data || error.message);
    res.status(500).json({ status: false, message: 'Failed to fetch banks' });
  }
});

// ==================== AUTH / USERS ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, regNumber, phone, hostel, roomNumber, bankName, bankCode, accountNumber, email, password } = req.body;
    
    if (!regNumber || !firstName || !lastName) {
      return res.status(400).json({ status: false, message: 'Missing required fields' });
    }

    const existing = await db.getUserByRegNumber(regNumber);
    if (existing && !password) {
      // Login attempt
      return res.json({ status: true, message: 'User exists', data: existing });
    }

    const user = {
      id: uuidv4(),
      firstName,
      lastName,
      regNumber,
      phone: phone || '',
      hostel: hostel || '',
      roomNumber: roomNumber || '',
      bankName: bankName || '',
      bankCode: bankCode || '',
      accountNumber: accountNumber || '',
      email: email || `${regNumber.replace(/\//g, '_')}@atbu.market`,
      subaccountCode: '',
      profileImage: '/default_avatar.jpg',
      createdAt: new Date().toISOString(),
    };

    await db.createUser(user);
    res.json({ status: true, message: 'User registered', data: user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ status: false, message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { regNumber } = req.body;
    const user = await db.getUserByRegNumber(regNumber);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }
    res.json({ status: true, data: user });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

// ==================== PRODUCTS ====================
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.getProducts();
    res.json({ status: true, data: products });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    // Prevent duplicates by ID
    const existing = await db.getProductById(req.body.id);
    if (existing) {
      return res.json({ status: true, data: existing, message: 'Product already exists' });
    }
    const product = {
      id: req.body.id || uuidv4(),
      ...req.body,
      createdAt: new Date().toISOString(),
    };
    await db.createProduct(product);
    res.json({ status: true, data: product });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

// ==================== SELLER SUBACCOUNT ====================
app.post('/api/sellers/subaccount', async (req, res) => {
  try {
    const { userId, businessName, bankCode, accountNumber } = req.body;
    
    if (!userId || !bankCode || !accountNumber) {
      return res.status(400).json({ status: false, message: 'Missing bank details' });
    }

    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    // If already has subaccount, return it
    if (user.subaccountCode) {
      return res.json({ status: true, data: { subaccountCode: user.subaccountCode } });
    }

    // Create Paystack subaccount
    const subaccountData = {
      business_name: businessName || `${user.firstName} ${user.lastName}`,
      bank_code: bankCode,
      account_number: accountNumber,
      percentage_charge: PLATFORM_FEE_PERCENT,
    };

    const response = await paystack.post('/subaccount', subaccountData);
    const subaccountCode = response.data.data.subaccount_code;

    // Save to user
    await db.updateUser(userId, { 
      subaccountCode,
      bankCode,
      accountNumber,
      bankName: businessName || user.bankName,
    });

    res.json({ status: true, data: { subaccountCode } });
  } catch (error) {
    console.error('Subaccount error:', error.response?.data || error.message);
    res.status(500).json({ 
      status: false, 
      message: error.response?.data?.message || error.message 
    });
  }
});

// ==================== PAYMENTS ====================
app.post('/api/payments/initialize', async (req, res) => {
  try {
    const { buyerId, productId, email } = req.body;
    
    if (!buyerId || !productId) {
      return res.status(400).json({ status: false, message: 'Missing buyer or product ID' });
    }

    const buyer = await db.getUserById(buyerId);
    const product = await db.getProductById(productId);
    
    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    const seller = await db.getUserById(product.sellerId);
    if (!seller) {
      return res.status(404).json({ status: false, message: 'Seller not found' });
    }

    // Generate unique reference
    const reference = `ATBU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const amountKobo = Math.round(product.price * 100);

    // Create order first
    const order = {
      id: uuidv4(),
      productId,
      buyerId,
      sellerId: seller.id,
      amount: product.price,
      status: 'pending',
      reference,
      paymentUrl: '',
      accessCode: '',
      paidAt: null,
      createdAt: new Date().toISOString(),
    };
    await db.createOrder(order);

    // Prepare Paystack payload
    const payload = {
      email: email || buyer?.email || 'guest@atbu.market',
      amount: amountKobo,
      reference,
      callback_url: `${FRONTEND_URL}/?payment_callback=1&reference=${reference}`,
      metadata: {
        order_id: order.id,
        product_id: productId,
        buyer_id: buyerId,
        seller_id: seller.id,
        cancel_action: `${FRONTEND_URL}/?payment_cancel=1&reference=${reference}`,
        custom_fields: [
          { display_name: 'Product', variable_name: 'product', value: product.title },
          { display_name: 'Buyer', variable_name: 'buyer', value: buyer?.firstName || 'Guest' },
          { display_name: 'Seller', variable_name: 'seller', value: seller.firstName },
        ],
      },
    };

    // Add subaccount if seller has one
    if (seller.subaccountCode) {
      payload.subaccount = seller.subaccountCode;
    }

    const response = await paystack.post('/transaction/initialize', payload);
    const { authorization_url, access_code } = response.data.data;

    // Update order with payment details
    await db.updateOrder(order.id, { 
      paymentUrl: authorization_url, 
      accessCode: access_code 
    });

    res.json({
      status: true,
      data: {
        authorization_url,
        access_code,
        reference,
        orderId: order.id,
      },
    });
  } catch (error) {
    console.error('Initialize payment error:', error.response?.data || error.message);
    res.status(500).json({
      status: false,
      message: error.response?.data?.message || 'Payment initialization failed',
    });
  }
});

app.get('/api/payments/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    
    const response = await paystack.get(`/transaction/verify/${reference}`);
    const transaction = response.data.data;

    if (transaction.status === 'success') {
      // Update order
      const order = await db.getOrderByReference(reference);
      if (order && order.status === 'pending') {
        await db.updateOrder(order.id, { 
          status: 'paid', 
          paidAt: transaction.paid_at 
        });
      }
    }

    res.json({ status: true, data: transaction });
  } catch (error) {
    console.error('Verify error:', error.response?.data || error.message);
    res.status(500).json({
      status: false,
      message: error.response?.data?.message || 'Verification failed',
    });
  }
});

// ==================== WEBHOOK ====================
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(req.body)
    .digest('hex');

  const signature = req.headers['x-paystack-signature'];

  if (hash !== signature) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const event = JSON.parse(req.body);
    console.log('Webhook received:', event.event);

    if (event.event === 'charge.success') {
      const { reference, status } = event.data;
      if (status === 'success') {
        const order = await db.getOrderByReference(reference);
        if (order && order.status === 'pending') {
          await db.updateOrder(order.id, { 
            status: 'paid', 
            paidAt: event.data.paid_at 
          });
          console.log(`Order ${order.id} marked as paid`);
        }
      }
    }

    // Handle refund events
    if (event.event === 'refund.processed') {
      const { transaction_reference } = event.data;
      const order = await db.getOrderByReference(transaction_reference);
      if (order) {
        await db.updateOrder(order.id, { status: 'refunded' });
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(200); // Always return 200 to prevent retries
  }
});

// ==================== ORDERS ====================
app.get('/api/orders/buyer/:buyerId', async (req, res) => {
  try {
    const orders = await db.getOrdersByBuyer(req.params.buyerId);
    res.json({ status: true, data: orders });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

app.get('/api/orders/seller/:sellerId', async (req, res) => {
  try {
    const orders = await db.getOrdersBySeller(req.params.sellerId);
    res.json({ status: true, data: orders });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const order = await db.getOrderById(req.params.orderId);
    if (!order) return res.status(404).json({ status: false, message: 'Order not found' });
    res.json({ status: true, data: order });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

app.patch('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const order = await db.updateOrder(req.params.orderId, { status });
    if (!order) return res.status(404).json({ status: false, message: 'Order not found' });
    res.json({ status: true, data: order });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

// ==================== REFUNDS ====================
app.post('/api/refunds', async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const order = await db.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ status: false, message: 'Order not found' });
    }

    const refundAmount = amount ? Math.round(amount * 100) : undefined;
    const payload = { transaction: order.reference };
    if (refundAmount) payload.amount = refundAmount;

    const response = await paystack.post('/refund', payload);
    
    // Update order status
    await db.updateOrder(orderId, { status: 'refund_pending' });

    res.json({ status: true, data: response.data.data });
  } catch (error) {
    console.error('Refund error:', error.response?.data || error.message);
    res.status(500).json({
      status: false,
      message: error.response?.data?.message || 'Refund failed',
    });
  }
});

// ==================== HEALTH ====================
app.get('/api/health', (req, res) => {
  res.json({ status: true, message: 'ATBU Marketplace API is running', publicKey: PAYSTACK_PUBLIC });
});

// ==================== STARTUP SEED ====================
const seedProducts = [
  { id: 'prod-1', title: 'Engineering Textbook Set', price: 4500, image: '/trending_textbooks.jpg', category: 'Textbooks', seller: 'John D.', sellerId: 'user-1', location: 'Male Hostel A', description: 'Complete set of engineering textbooks for 300 level. Good condition, barely used.' },
  { id: 'prod-2', title: 'Bluetooth Speaker', price: 8000, image: '/trending_speaker.jpg', category: 'Electronics', seller: 'Sarah M.', sellerId: 'user-2', location: 'Female Hostel B', description: 'JBL Bluetooth speaker with amazing bass. 10 hours battery life.' },
  { id: 'prod-3', title: 'Room Rug', price: 6000, image: '/trending_rug.jpg', category: 'Room Essentials', seller: 'Mike O.', sellerId: 'user-3', location: 'Male Hostel C', description: 'Beautiful woven rug, perfect for hostel rooms. 4x6 feet.' },
  { id: 'prod-4', title: 'Scientific Calculator', price: 3500, image: '/trending_calculator.jpg', category: 'Electronics', seller: 'Jane K.', sellerId: 'user-4', location: 'Female Hostel A', description: 'Casio fx-991ES PLUS. Perfect for engineering and science students.' },
  { id: 'prod-5', title: 'Table Lamp', price: 2500, image: '/trending_lamp.jpg', category: 'Room Essentials', seller: 'Paul R.', sellerId: 'user-5', location: 'Male Hostel B', description: 'LED desk lamp with adjustable brightness. USB powered.' },
  { id: 'prod-6', title: 'Laptop Stand', price: 5500, image: '/trending_laptop_stand.jpg', category: 'Electronics', seller: 'Lisa T.', sellerId: 'user-6', location: 'Female Hostel C', description: 'Aluminum laptop stand, adjustable height. Great for ergonomics.' },
  { id: 'prod-7', title: 'Power Bank 20000mAh', price: 7000, image: '/trending_powerbank.jpg', category: 'Electronics', seller: 'David A.', sellerId: 'user-7', location: 'Male Hostel A', description: 'Fast charging power bank with digital display. Can charge laptop too.' },
  { id: 'prod-8', title: 'Wireless Mouse', price: 3000, image: '/trending_mouse.jpg', category: 'Electronics', seller: 'Emma W.', sellerId: 'user-8', location: 'Female Hostel B', description: 'Logitech wireless mouse, 2 years old but works perfectly.' },
];

async function startupSeed() {
  try {
    const existing = await db.getProducts();
    if (existing.length === 0) {
      // Create a seed seller so products have a real sellerId
      let seedSeller = await db.getUserByEmail('seed@atbu.edu');
      if (!seedSeller) {
        seedSeller = await db.createUser({
          id: 'seed-seller-' + Date.now(),
          firstName: 'Seed',
          lastName: 'Seller',
          regNumber: 'ATBU/SEED/001',
          phone: '08000000000',
          hostel: 'Male A',
          roomNumber: '001',
          bankCode: '057',
          accountNumber: '0000000000',
          email: 'seed@atbu.edu',
          password: 'seed',
          subaccountCode: null,
          createdAt: new Date().toISOString(),
        });
      }
      for (const p of seedProducts) {
        await db.createProduct({ ...p, sellerId: seedSeller.id, createdAt: new Date().toISOString() });
      }
      console.log(`✅ Seeded ${seedProducts.length} products with seller ${seedSeller.id}`);
    }
  } catch (err) {
    console.log('⚠️ Could not seed products:', err.message);
  }
}

// ==================== STATIC (PRODUCTION) ====================
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

app.listen(PORT, async () => {
  console.log(`\n🚀 ATBU Marketplace Server running on port ${PORT}`);
  await startupSeed();
  console.log(`📍 Frontend URL: ${FRONTEND_URL}`);
  console.log(`🔑 Paystack mode: ${PAYSTACK_SECRET.startsWith('sk_test') ? 'TEST' : 'LIVE'}`);
  console.log(`💰 Platform fee: ${PLATFORM_FEE_PERCENT}%`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/banks`);
  console.log(`   POST /api/auth/register`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/products`);
  console.log(`   POST /api/products`);
  console.log(`   POST /api/sellers/subaccount`);
  console.log(`   POST /api/payments/initialize`);
  console.log(`   GET  /api/payments/verify/:reference`);
  console.log(`   POST /api/webhook`);
  console.log(`   GET  /api/orders/buyer/:buyerId`);
  console.log(`   GET  /api/orders/seller/:sellerId`);
  console.log(`   PATCH /api/orders/:orderId/status`);
  console.log(`   POST /api/refunds`);
  console.log('');
});
