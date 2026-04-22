# ATBU Marketplace - Paystack Integration

## What Was Built

Full Paystack payment integration for the ATBU Marketplace with the following features:

### Backend (Node.js + Express)
- **Secure API** - Paystack secret key never exposed to frontend
- **Seller Subaccounts** - Each seller gets a Paystack subaccount for automatic split payments
- **Payment Initialization** - Creates orders and initializes Paystack transactions with 90/10 split
- **Payment Verification** - Verifies transaction status via Paystack API
- **Webhook Handler** - Receives and validates `charge.success` events from Paystack
- **Refund API** - Platform can initiate refunds when needed
- **Bank List** - Fetches real Nigerian banks from Paystack for seller onboarding

### Frontend (React + Vite)
- **Paystack Checkout** - Uses `@paystack/inline-js` Popup for payment
- **OPay Support** - OPay appears automatically in Paystack checkout alongside Cards, Bank Transfer, USSD
- **Real Order Flow** - Orders created in backend, status tracked (pending → paid → shipped → delivered)
- **Bank Dropdown** - Sellers select from real Nigerian banks instead of typing
- **Automatic Subaccount Creation** - Seller's Paystack subaccount created on registration

## 10% Platform Fee Architecture

When a seller registers:
1. Backend calls `POST /subaccount` with `percentage_charge: 10`
2. Paystack creates a subaccount for the seller

When a buyer pays:
1. Backend initializes transaction with `subaccount: "ACCT_xxx"`
2. Paystack automatically splits settlement:
   - **90% → Seller's bank account**
   - **10% → Platform's Paystack balance**

## Running the App

### Development (both frontend + backend)
```bash
# 1. Install frontend dependencies
npm install

# 2. Install backend dependencies
cd server && npm install && cd ..

# 3. Start both frontend and backend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

### Production
```bash
npm install
cd server && npm install && cd ..
npm run build
npm run start
```

The server serves both the API and the built frontend from port 5000.

## API Keys

Test keys are already configured in `.env`:
- **Test Secret**: `sk_test_13f4c3c07dbeb4af283d75217c7b9c84da6e3b70`
- **Test Public**: `pk_test_c6831f84c3aa5bb069f0def3b94579c29651760c`

To switch to live mode, uncomment the live keys in `.env` and comment out the test keys.

**IMPORTANT**: `.env` and `server/database.json` are in `.gitignore` - never commit them.

## Paystack Dashboard Setup

Before going live, update these in your Paystack Dashboard:

1. **Callback URL**: Set to your production domain (e.g., `https://yourdomain.com`)
2. **Webhook URL**: Set to `https://yourdomain.com/api/webhook`
3. **Enable OPay**: Go to Settings → Payment Channels → enable OPay

## Test Payment Credentials

Use these test cards from Paystack docs:
- **Successful (no validation)**: `4084 0840 8408 4081`, CVV: `408`, Expiry: any future date
- **PIN validation**: `5078 5078 5078 5078 12`, CVV: `081`, PIN: `1111`
- **PIN + OTP**: `5060 6666 6666 6666 666`, CVV: `123`, PIN: `1234`, OTP: `123456`

For OPay testing: Use the Paystack test environment - OPay will be in test mode automatically.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Check server status |
| GET | `/api/banks` | List Nigerian banks |
| POST | `/api/auth/register` | Register user + create subaccount |
| POST | `/api/auth/login` | Login user |
| GET | `/api/products` | List products |
| POST | `/api/products` | Create product |
| POST | `/api/sellers/subaccount` | Create Paystack subaccount |
| POST | `/api/payments/initialize` | Initialize Paystack payment |
| GET | `/api/payments/verify/:reference` | Verify payment status |
| POST | `/api/webhook` | Paystack webhook |
| GET | `/api/orders/buyer/:buyerId` | Get buyer's orders |
| GET | `/api/orders/seller/:sellerId` | Get seller's orders |
| PATCH | `/api/orders/:orderId/status` | Update order status |
| POST | `/api/refunds` | Initiate refund |

## File Structure

```
├── .env                          # API keys (gitignored)
├── server/
│   ├── index.js                  # Express server + Paystack routes
│   ├── database.js               # JSON file database
│   └── package.json              # Backend dependencies
├── src/
│   ├── App.tsx                   # Main app with Paystack integration
│   ├── hooks/
│   │   └── use-paystack.ts       # Paystack Popup hook
│   └── lib/
│       └── api.ts                # Frontend API client
```
