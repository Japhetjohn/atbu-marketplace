import { useState, useEffect, useCallback } from 'react';
import {
  Menu, X, Camera, Shield, MapPin, ArrowLeft,
  Search, Phone, Home, CreditCard, Mail,
  Edit3, Check, XIcon, Package, Clock, CheckCircle,
  Bell, Truck, RotateCcw, Banknote, Loader2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePaystack } from '@/hooks/use-paystack';
import {
  registerUser, loginUser, getBanks, createSubaccount,
  initializePayment, verifyPayment, getProducts, createProduct,
  getBuyerOrders, getSellerOrders, updateOrderStatus, getHealth
} from '@/lib/api';
import { toast } from 'sonner';

// Types
interface Product {
  id: string;
  title: string;
  price: number;
  image: string;
  category: string;
  seller: string;
  sellerId: string;
  location: string;
  description: string;
}

interface Order {
  id: string;
  product: Product;
  buyerId: string;
  sellerId: string;
  buyerName: string;
  sellerName: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  date: string;
  type: 'bought' | 'sold';
  reference?: string;
  amount: number;
  paidAt?: string;
}

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  regNumber: string;
  phone: string;
  hostel: string;
  roomNumber: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  subaccountCode: string;
  profileImage: string;
  email: string;
}

interface Notification {
  id: number;
  message: string;
  type: 'order' | 'payment' | 'message';
  read: boolean;
  date: string;
}

interface Bank {
  id: number;
  name: string;
  code: string;
}

// Status helpers
const getStatusColor = (status: string) => {
  switch (status) {
    case 'delivered': return 'bg-green-100 text-green-700';
    case 'shipped': return 'bg-blue-100 text-blue-700';
    case 'paid': return 'bg-[#0B1E4A] text-white';
    case 'pending': return 'bg-yellow-100 text-yellow-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    case 'refunded': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'delivered': return 'Delivered';
    case 'shipped': return 'Shipped';
    case 'paid': return 'Paid - Awaiting Delivery';
    case 'pending': return 'Pending Payment';
    case 'cancelled': return 'Cancelled';
    case 'refunded': return 'Refunded';
    default: return status;
  }
};

// Sample Products Data
const sampleProducts: Product[] = [
  { id: 'prod-1', title: 'Engineering Textbook Set', price: 4500, image: '/trending_textbooks.jpg', category: 'Textbooks', seller: 'John D.', sellerId: 'user-1', location: 'Male Hostel A', description: 'Complete set of engineering textbooks for 300 level. Good condition, barely used.' },
  { id: 'prod-2', title: 'Bluetooth Speaker', price: 8000, image: '/trending_speaker.jpg', category: 'Electronics', seller: 'Sarah M.', sellerId: 'user-2', location: 'Female Hostel B', description: 'JBL Bluetooth speaker with amazing bass. 10 hours battery life.' },
  { id: 'prod-3', title: 'Room Rug', price: 6000, image: '/trending_rug.jpg', category: 'Room Essentials', seller: 'Mike O.', sellerId: 'user-3', location: 'Male Hostel C', description: 'Beautiful woven rug, perfect for hostel rooms. 4x6 feet.' },
  { id: 'prod-4', title: 'Scientific Calculator', price: 3500, image: '/trending_calculator.jpg', category: 'Electronics', seller: 'Jane K.', sellerId: 'user-4', location: 'Female Hostel A', description: 'Casio fx-991ES PLUS. Perfect for engineering and science students.' },
  { id: 'prod-5', title: 'Table Lamp', price: 2500, image: '/trending_lamp.jpg', category: 'Room Essentials', seller: 'Paul R.', sellerId: 'user-5', location: 'Male Hostel B', description: 'LED desk lamp with adjustable brightness. USB powered.' },
  { id: 'prod-6', title: 'Laptop Stand', price: 5500, image: '/trending_laptop_stand.jpg', category: 'Electronics', seller: 'Lisa T.', sellerId: 'user-6', location: 'Female Hostel C', description: 'Aluminum laptop stand, adjustable height. Great for ergonomics.' },
  { id: 'prod-7', title: 'Power Bank 20000mAh', price: 7000, image: '/trending_powerbank.jpg', category: 'Electronics', seller: 'David A.', sellerId: 'user-7', location: 'Male Hostel A', description: 'Fast charging power bank with digital display. Can charge laptop too.' },
  { id: 'prod-8', title: 'Wireless Mouse', price: 3000, image: '/trending_mouse.jpg', category: 'Electronics', seller: 'Emma W.', sellerId: 'user-8', location: 'Female Hostel B', description: 'Logitech wireless mouse, 2 years old but works perfectly.' },
];

// Seed products to backend on first load
let seedPromise: Promise<void> | null = null;
async function seedProducts() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      const existing = await getProducts();
      if (existing.length === 0) {
        for (const p of sampleProducts) {
          await createProduct(p).catch(() => {}); // ignore duplicates
        }
      }
    } catch {
      // backend may not be ready yet
    }
  })();
  return seedPromise;
}

// Navigation Component
function Navigation({ onNavigate, user, notifications }: { onNavigate: (page: string) => void; user: UserProfile | null; notifications: Notification[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="w-full px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 lg:h-16">
          <button onClick={() => onNavigate('marketplace')} className="flex items-center gap-2.5">
            <img src="/atbu_icon.jpg" alt="ATBU" className="h-8 w-8 lg:h-9 lg:w-9 object-contain" />
            <span className="font-bold text-sm lg:text-lg tracking-tight text-[#0B1E4A]" style={{ fontFamily: 'Space Grotesk' }}>
              ATBU Marketplace
            </span>
          </button>

          <div className="hidden lg:flex items-center gap-6">
            <button onClick={() => onNavigate('marketplace')} className="text-sm font-medium text-[#0B1E4A] hover:text-[#2F6BFF] transition-colors">Browse</button>
            <button onClick={() => onNavigate('orders')} className="text-sm font-medium text-[#0B1E4A] hover:text-[#2F6BFF] transition-colors">My Orders</button>
            <button onClick={() => onNavigate('sell')} className="text-sm font-medium text-[#0B1E4A] hover:text-[#2F6BFF] transition-colors">Sell</button>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <button className="relative p-2 hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5 text-[#0B1E4A]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center">{unreadCount}</span>
              )}
            </button>
            {user ? (
              <button onClick={() => onNavigate('profile')} className="flex items-center gap-2 text-sm font-medium text-[#0B1E4A]">
                <img src={user.profileImage || '/default_avatar.jpg'} alt="Profile" className="w-8 h-8 object-cover border-2 border-[#2F6BFF]" />
              </button>
            ) : (
              <button onClick={() => onNavigate('auth')} className="text-sm font-medium text-[#0B1E4A] hover:text-[#2F6BFF]">Log In</button>
            )}
            <button onClick={() => onNavigate('sell')} className="bg-[#2F6BFF] hover:bg-[#1a5aee] text-white px-4 py-2 text-sm font-medium transition-colors">Sell</button>
          </div>

          <button onClick={() => setIsOpen(!isOpen)} className="lg:hidden p-2">
            {isOpen ? <X className="w-5 h-5 text-[#0B1E4A]" /> : <Menu className="w-5 h-5 text-[#0B1E4A]" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100">
          <div className="px-4 py-3 space-y-2">
            <button onClick={() => { onNavigate('marketplace'); setIsOpen(false); }} className="block w-full text-left text-[#0B1E4A] font-medium py-2 text-sm">Browse</button>
            <button onClick={() => { onNavigate('orders'); setIsOpen(false); }} className="block w-full text-left text-[#0B1E4A] font-medium py-2 text-sm">My Orders</button>
            <button onClick={() => { onNavigate('sell'); setIsOpen(false); }} className="block w-full text-left text-[#0B1E4A] font-medium py-2 text-sm">Sell</button>
            <hr className="my-2" />
            {user ? (
              <button onClick={() => { onNavigate('profile'); setIsOpen(false); }} className="block w-full text-left text-[#0B1E4A] font-medium py-2 text-sm">My Profile</button>
            ) : (
              <button onClick={() => { onNavigate('auth'); setIsOpen(false); }} className="block w-full text-left text-[#0B1E4A] font-medium py-2 text-sm">Log In / Sign Up</button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

// Footer Component
function Footer() {
  return (
    <footer className="bg-[#0B1E4A] text-white">
      <div className="w-full px-4 lg:px-8 py-8 lg:py-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <img src="/atbu_icon.jpg" alt="ATBU" className="h-6 w-6 object-contain" />
                <span className="font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>ATBU Marketplace</span>
              </div>
              <p className="text-white/50 text-xs">The safest place for ATBU students to buy, sell, and swap items.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-xs uppercase tracking-wide">Quick Links</h4>
              <ul className="space-y-1">
                <li><button onClick={() => {}} className="text-white/50 hover:text-white transition-colors text-xs">Browse Items</button></li>
                <li><button onClick={() => {}} className="text-white/50 hover:text-white transition-colors text-xs">My Orders</button></li>
                <li><button onClick={() => {}} className="text-white/50 hover:text-white transition-colors text-xs">Sell an Item</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-xs uppercase tracking-wide">Support</h4>
              <ul className="space-y-1">
                <li><button onClick={() => {}} className="text-white/50 hover:text-white transition-colors text-xs">Safety Tips</button></li>
                <li><button onClick={() => {}} className="text-white/50 hover:text-white transition-colors text-xs">Contact Us</button></li>
                <li><button onClick={() => {}} className="text-white/50 hover:text-white transition-colors text-xs">FAQ</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-xs uppercase tracking-wide">Contact</h4>
              <ul className="space-y-1">
                <li className="flex items-center gap-1 text-white/50 text-xs"><Mail className="w-3 h-3" />support@atbu.market</li>
                <li className="flex items-center gap-1 text-white/50 text-xs"><Phone className="w-3 h-3" />+234 800 ATBU</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-[10px] text-white/30">ATBU Marketplace. Built for ATBU students.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Hero Slider Component
function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = ['/hero_1.jpg', '/hero_2.jpg', '/hero_3.jpg'];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <div className="relative w-full bg-[#0B1E4A] overflow-hidden">
      <div className="relative h-[180px] sm:h-[240px] lg:h-[300px]">
        {slides.map((slide, index) => (
          <div key={index} className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}>
            <img src={slide} alt={`Slide ${index + 1}`} className="w-full h-full object-cover object-center" loading={index === 0 ? "eager" : "lazy"} />
          </div>
        ))}
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {slides.map((_, index) => (
          <button key={index} onClick={() => setCurrentSlide(index)} className={`h-1 transition-all ${index === currentSlide ? 'bg-white w-4' : 'bg-white/40 w-1'}`} />
        ))}
      </div>
    </div>
  );
}

// Walkthrough Component
function Walkthrough({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const slides = [
    { image: '/walkthrough_1.jpg', title: 'Snap a Photo', desc: 'Take a picture of what you want to sell' },
    { image: '/walkthrough_2.jpg', title: 'Meet Safely', desc: 'Exchange items with students on campus' },
    { image: '/walkthrough_3.jpg', title: 'Get Paid', desc: 'Receive money directly to your account' },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-[#0B1E4A] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xs">
          <img src={slides[step].image} alt={slides[step].title} className="w-full aspect-[3/2] object-contain mb-6" loading="eager" />
          <h2 className="text-lg font-bold text-white text-center mb-2" style={{ fontFamily: 'Space Grotesk' }}>{slides[step].title}</h2>
          <p className="text-white/60 text-center text-sm">{slides[step].desc}</p>
        </div>
      </div>
      <div className="p-6 pb-8">
        <div className="flex justify-center gap-1.5 mb-5">
          {slides.map((_, index) => (
            <div key={index} className={`h-1 transition-all ${index === step ? 'bg-[#2F6BFF] w-4' : 'bg-white/30 w-1'}`} />
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onComplete} className="flex-1 py-3 text-sm text-white/50 font-medium">Skip</button>
          <button onClick={() => { if (step < slides.length - 1) { setStep(step + 1); } else { onComplete(); } }} className="flex-1 bg-[#2F6BFF] hover:bg-[#1a5aee] text-white py-3 text-sm font-medium transition-colors">
            {step < slides.length - 1 ? 'Next' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Product Detail Page
function ProductDetailPage({ product, user, onNavigate, onBack }: { product: Product; user: UserProfile | null; onNavigate: (page: string) => void; onBack: () => void }) {
  const [showPayment, setShowPayment] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const { openCheckout } = usePaystack();

  const handleBuy = () => {
    if (!user) {
      onNavigate('auth');
      return;
    }
    setShowPayment(true);
  };

  const handlePay = async () => {
    if (!user) return;
    setIsPaying(true);
    try {
      const data = await initializePayment({
        buyerId: user.id,
        productId: product.id,
        email: user.email,
      });

      // Open Paystack checkout
      await openCheckout(data.access_code);

      // After popup closes, verify payment
      setTimeout(async () => {
        try {
          const verifyData: any = await verifyPayment(data.reference);
          if (verifyData.status === 'success') {
            toast.success('Payment successful! Your order has been created.');
            setShowPayment(false);
            onBack();
            onNavigate('orders');
          } else {
            toast.error('Payment was not completed. Please try again.');
          }
        } catch (e) {
          toast.error('Could not verify payment. Please check your orders.');
        }
        setIsPaying(false);
      }, 3000);
    } catch (error: any) {
      toast.error(error.message || 'Payment initialization failed');
      setIsPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-14 lg:top-16 z-40 bg-white border-b border-gray-100">
        <div className="w-full px-4 lg:px-8 py-3">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#0B1E4A] hover:text-[#2F6BFF] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to browsing
          </button>
        </div>
      </div>

      <div className="w-full px-4 lg:px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="aspect-square bg-[#F6F7F9]">
              <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
            </div>

            <div className="py-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-[#F6F7F9] text-[10px] text-[#6B7280]">{product.category}</span>
              </div>
              <h1 className="text-xl lg:text-2xl font-bold text-[#0B1E4A] mb-2" style={{ fontFamily: 'Space Grotesk' }}>{product.title}</h1>
              <p className="text-2xl font-bold text-[#2F6BFF] mb-4">N{product.price.toLocaleString()}</p>

              <div className="bg-[#F6F7F9] p-3 mb-4">
                <p className="text-[10px] text-[#9CA3AF] mb-1">Description</p>
                <p className="text-sm text-[#6B7280] leading-relaxed">{product.description}</p>
              </div>

              <div className="bg-[#F6F7F9] p-3 mb-4">
                <p className="text-[10px] text-[#9CA3AF] mb-2">Seller Information</p>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-[#0B1E4A] flex items-center justify-center text-white text-xs font-bold">{product.seller[0]}</div>
                  <div>
                    <p className="text-sm font-medium text-[#0B1E4A]">{product.seller}</p>
                    <div className="flex items-center gap-1 text-[10px] text-[#9CA3AF]"><MapPin className="w-3 h-3" />{product.location}</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 p-3 mb-4">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-[#2F6BFF] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-[#0B1E4A] mb-0.5">Escrow Protected</p>
                    <p className="text-[10px] text-[#6B7280]">Your payment is held safely until you confirm delivery. Not satisfied? You can request a full refund before confirming.</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-100 p-3 mb-4">
                <div className="flex items-start gap-2">
                  <Banknote className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-[#0B1E4A] mb-0.5">Platform Fee: 10%</p>
                    <p className="text-[10px] text-[#6B7280]">N{Math.round(product.price * 0.1).toLocaleString()} goes to ATBU Marketplace. Seller receives N{Math.round(product.price * 0.9).toLocaleString()}.</p>
                  </div>
                </div>
              </div>

              <button onClick={handleBuy} className="w-full bg-[#0B1E4A] hover:bg-[#1a3a7a] text-white py-3.5 text-sm font-medium transition-colors">
                {user ? 'Buy Now' : 'Log In to Buy'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-sm border-0 gap-0">
          <DialogHeader className="pb-2"><DialogTitle className="text-sm">Complete Purchase</DialogTitle></DialogHeader>
          <div>
            <div className="bg-[#F6F7F9] p-2.5 mb-4">
              <div className="flex items-center gap-3">
                <img src={product.image} alt={product.title} className="w-12 h-12 object-cover" />
                <div>
                  <p className="text-xs font-medium text-[#0B1E4A] truncate max-w-[140px]">{product.title}</p>
                  <p className="text-[#2F6BFF] font-bold text-sm">N{product.price.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-2.5 mb-4">
              <div className="flex items-start gap-2">
                <RotateCcw className="w-3.5 h-3.5 text-[#2F6BFF] flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-[#6B7280]">Payment is processed securely by Paystack. You can pay with OPay, Card, Bank Transfer, or USSD.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-green-50 border border-green-100 p-2.5 mb-4">
                <p className="text-[10px] text-green-700">
                  <span className="font-medium">Platform fee:</span> N{Math.round(product.price * 0.1).toLocaleString()} (10%)<br />
                  <span className="font-medium">Seller receives:</span> N{Math.round(product.price * 0.9).toLocaleString()} (90%)
                </p>
              </div>

              <button
                onClick={handlePay}
                disabled={isPaying}
                className="w-full bg-[#0B1E4A] hover:bg-[#1a3a7a] disabled:opacity-50 text-white py-3.5 text-sm font-medium transition-colors mt-1 flex items-center justify-center gap-2"
              >
                {isPaying && <Loader2 className="w-4 h-4 animate-spin" />}
                {isPaying ? 'Processing...' : 'Pay with Paystack'}
              </button>
              <p className="text-[9px] text-center text-[#9CA3AF]">Secured by Paystack. Supports OPay, Cards, Bank Transfer & USSD.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Order Detail Page
function OrderDetailPage({ order, user, onBack, onUpdate }: { order: Order; user: UserProfile | null; onBack: () => void; onUpdate: () => void }) {
  if (!user) return null;

  const handleMarkShipped = async () => {
    try {
      await updateOrderStatus(order.id, 'shipped');
      toast.success('Order marked as shipped!');
      onUpdate();
    } catch {
      toast.error('Failed to update order');
    }
  };

  const handleMarkDelivered = async () => {
    try {
      await updateOrderStatus(order.id, 'delivered');
      toast.success('Order marked as delivered!');
      onUpdate();
    } catch {
      toast.error('Failed to update order');
    }
  };

  const handleRequestRefund = async () => {
    try {
      await updateOrderStatus(order.id, 'refunded');
      toast.success('Refund request submitted!');
      onUpdate();
    } catch {
      toast.error('Failed to request refund');
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <div className="sticky top-14 lg:top-16 z-40 bg-white border-b border-gray-100">
        <div className="w-full px-4 lg:px-8 py-3">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#0B1E4A] hover:text-[#2F6BFF] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to orders
          </button>
        </div>
      </div>

      <div className="w-full px-4 lg:px-8 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="aspect-square bg-white mb-3 max-h-[300px]">
            <img src={order.product.image} alt={order.product.title} className="w-full h-full object-contain" />
          </div>

          <div className="bg-white p-4 mb-3">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h1 className="text-base font-bold text-[#0B1E4A]" style={{ fontFamily: 'Space Grotesk' }}>{order.product.title}</h1>
                <p className="text-lg font-bold text-[#2F6BFF]">N{order.amount.toLocaleString()}</p>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${getStatusColor(order.status)}`}>{getStatusText(order.status)}</span>
            </div>

            <div className="flex items-center gap-1 mb-4">
              {['pending', 'paid', 'shipped', 'delivered'].map((s, i, arr) => {
                const statusIndex = arr.indexOf(order.status);
                const isActive = i <= statusIndex;
                return (
                  <div key={s} className="flex-1 flex items-center">
                    <div className={`h-1.5 flex-1 ${isActive ? 'bg-[#2F6BFF]' : 'bg-gray-200'}`} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-[#9CA3AF] mb-1">
              <span>Pending</span><span>Paid</span><span>Shipped</span><span>Delivered</span>
            </div>
          </div>

          <div className="bg-white p-4 mb-3">
            <h2 className="font-semibold text-[#0B1E4A] text-sm mb-3">Order Details</h2>
            <div className="space-y-2.5">
              <div className="flex justify-between text-xs"><span className="text-[#9CA3AF]">Order Type</span><span className="font-medium text-[#0B1E4A]">{order.type === 'bought' ? 'Purchase' : 'Sale'}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[#9CA3AF]">{order.type === 'bought' ? 'Seller' : 'Buyer'}</span><span className="font-medium text-[#0B1E4A]">{order.type === 'bought' ? order.sellerName : order.buyerName}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[#9CA3AF]">Date</span><span className="font-medium text-[#0B1E4A]">{order.date}</span></div>
              {order.reference && <div className="flex justify-between text-xs"><span className="text-[#9CA3AF]">Reference</span><span className="font-medium text-[#0B1E4A] text-[10px]">{order.reference}</span></div>}
            </div>
          </div>

          {order.type === 'bought' && order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'refunded' && (
            <div className="bg-blue-50 border border-blue-100 p-4 mb-3">
              <div className="flex items-start gap-2 mb-2">
                <Shield className="w-4 h-4 text-[#2F6BFF] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-[#0B1E4A] mb-0.5">Buyer Protection</p>
                  <p className="text-[10px] text-[#6B7280]">Your payment is held in escrow. If you don&apos;t receive your item or it&apos;s not as described, you can request a full refund before confirming delivery.</p>
                </div>
              </div>
            </div>
          )}

          {order.type === 'sold' && (order.status === 'paid' || order.status === 'shipped') && (
            <div className="bg-amber-50 border border-amber-100 p-4 mb-3">
              <div className="flex items-start gap-2 mb-2">
                <Banknote className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-[#0B1E4A] mb-0.5">Funds Pending Release</p>
                  <p className="text-[10px] text-[#6B7280]">Payment received and held safely. 90% (N{Math.round(order.amount * 0.9).toLocaleString()}) will be released to your bank account once the buyer confirms delivery. Platform keeps 10% (N{Math.round(order.amount * 0.1).toLocaleString()}).</p>
                </div>
              </div>
            </div>
          )}

          {order.type === 'sold' && order.status === 'delivered' && (
            <div className="bg-green-50 border border-green-100 p-4 mb-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-[#0B1E4A] mb-0.5">Funds Released</p>
                  <p className="text-[10px] text-[#6B7280]">N{Math.round(order.amount * 0.9).toLocaleString()} has been released to your bank account. Platform fee: N{Math.round(order.amount * 0.1).toLocaleString()}.</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {order.type === 'bought' && order.status === 'paid' && (
              <>
                <div className="bg-yellow-50 p-3 text-xs text-yellow-700 mb-2">
                  <p className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" />Seller is preparing your item for delivery</p>
                </div>
                <button onClick={handleMarkDelivered} className="w-full bg-[#0B1E4A] hover:bg-[#1a3a7a] text-white py-3 text-sm font-medium transition-colors">Mark as Received</button>
                <button onClick={handleRequestRefund} className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 py-3 text-sm font-medium transition-colors">Request Refund</button>
              </>
            )}
            {order.type === 'bought' && order.status === 'shipped' && (
              <>
                <div className="bg-blue-50 p-3 text-xs text-blue-700 mb-2">
                  <p className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" />Your item is on the way!</p>
                </div>
                <button onClick={handleMarkDelivered} className="w-full bg-[#0B1E4A] hover:bg-[#1a3a7a] text-white py-3 text-sm font-medium transition-colors">Mark as Received</button>
                <button onClick={handleRequestRefund} className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 py-3 text-sm font-medium transition-colors">Request Refund</button>
              </>
            )}
            {order.type === 'bought' && order.status === 'pending' && (
              <button className="w-full bg-[#0B1E4A] hover:bg-[#1a3a7a] text-white py-3 text-sm font-medium transition-colors">Complete Payment</button>
            )}
            {order.type === 'sold' && order.status === 'paid' && (
              <>
                <div className="bg-yellow-50 p-3 text-xs text-yellow-700 mb-2">
                  <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Waiting for buyer to confirm delivery. Funds will be released after confirmation.</p>
                </div>
                <button onClick={handleMarkShipped} className="w-full bg-[#0B1E4A] hover:bg-[#1a3a7a] text-white py-3 text-sm font-medium transition-colors">Mark as Shipped</button>
              </>
            )}
            {order.type === 'sold' && order.status === 'shipped' && (
              <div className="bg-blue-50 p-3 text-xs text-blue-700">
                <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Waiting for buyer to confirm delivery. Funds will be released to your account after confirmation.</p>
              </div>
            )}
            {order.status === 'delivered' && (
              <div className="bg-green-50 p-3 text-xs text-green-700">
                <p className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" />Transaction completed successfully.</p>
              </div>
            )}
            {order.status === 'refunded' && (
              <div className="bg-gray-50 p-3 text-xs text-gray-700">
                <p className="flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Refund has been processed.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Marketplace Page
function MarketplacePage({ products, onProductClick }: { products: Product[]; onProductClick: (product: Product) => void }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', 'Textbooks', 'Electronics', 'Fashion', 'Room Essentials'];

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9]">
      <HeroSlider />
      <div className="flex-1 w-full px-4 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="mb-5">
            <div className="relative w-full mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <Input placeholder="Search for items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 py-4 bg-white text-sm border-0" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-[#0B1E4A] text-white' : 'bg-white text-[#0B1E4A]'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[#9CA3AF] text-sm">No items found</p>
              <button onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }} className="mt-3 px-4 py-2 bg-[#0B1E4A] text-white text-xs font-medium hover:bg-[#1a3a7a] transition-colors">Clear Filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 lg:gap-3">
              {filteredProducts.map((product) => (
                <div key={product.id} onClick={() => onProductClick(product)} className="bg-white cursor-pointer hover:shadow-sm transition-shadow">
                  <div className="aspect-square overflow-hidden bg-[#F6F7F9]">
                    <img src={product.image} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-2.5">
                    <h3 className="font-medium text-[#0B1E4A] text-xs truncate">{product.title}</h3>
                    <p className="text-[#2F6BFF] font-bold text-sm mt-0.5">N{product.price.toLocaleString()}</p>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-[#9CA3AF]">
                      <MapPin className="w-3 h-3" />{product.location}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

// Orders Page
function OrdersPage({ user, orders, onNavigate, onOrderClick }: { user: UserProfile | null; orders: Order[]; onNavigate: (page: string) => void; onOrderClick: (order: Order) => void }) {
  const [activeTab, setActiveTab] = useState<'all' | 'bought' | 'sold'>('all');

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true;
    return order.type === activeTab;
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B1E4A]">
        <div className="flex items-center justify-center px-4 py-12" style={{ minHeight: 'calc(100vh - 56px)' }}>
          <div className="text-center">
            <img src="/login_illustration.jpg" alt="Login" className="w-36 h-28 object-contain mx-auto mb-4" />
            <h1 className="text-lg font-bold text-white mb-2">Please Log In</h1>
            <p className="text-white/60 mb-5 text-sm">You need to be logged in to view your orders.</p>
            <button onClick={() => onNavigate('auth')} className="bg-[#2F6BFF] hover:bg-[#1a5aee] text-white px-6 py-3 text-sm font-medium transition-colors">Log In / Sign Up</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <div className="w-full px-4 lg:px-8 py-5">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-bold text-[#0B1E4A] mb-4" style={{ fontFamily: 'Space Grotesk' }}>My Orders</h1>
          <div className="flex gap-2 mb-4">
            {(['all', 'bought', 'sold'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${activeTab === tab ? 'bg-[#0B1E4A] text-white' : 'bg-white text-[#0B1E4A]'}`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filteredOrders.length === 0 ? (
              <div className="bg-white p-8 text-center"><Package className="w-10 h-10 text-[#D1D5DB] mx-auto mb-2" /><p className="text-[#9CA3AF] text-sm">No orders yet</p></div>
            ) : (
              filteredOrders.map((order) => (
                <div key={order.id} onClick={() => onOrderClick(order)} className="bg-white p-3 cursor-pointer hover:shadow-sm transition-shadow">
                  <div className="flex gap-3">
                    <div className="w-14 h-14 bg-[#F6F7F9] flex-shrink-0"><img src={order.product.image} alt={order.product.title} className="w-full h-full object-cover" loading="lazy" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-[#0B1E4A] text-xs truncate">{order.product.title}</h3>
                          <p className="text-[#2F6BFF] font-bold text-sm">N{order.amount.toLocaleString()}</p>
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-medium flex-shrink-0 ${getStatusColor(order.status)}`}>{getStatusText(order.status)}</span>
                      </div>
                      <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-[#9CA3AF]">
                        <span>{order.type === 'bought' ? `From: ${order.sellerName}` : `To: ${order.buyerName}`}</span>
                        <span>{order.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Auth Page
function AuthPage({ onLogin, banks }: { onLogin: (user: UserProfile) => void; banks: Bank[] }) {
  const [isSignup, setIsSignup] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', regNumber: '', phone: '', hostel: '', roomNumber: '', bankCode: '', accountNumber: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const selectedBank = banks.find(b => b.code === formData.bankCode);
      const userData: Partial<UserProfile> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        regNumber: formData.regNumber,
        phone: formData.phone,
        hostel: formData.hostel,
        roomNumber: formData.roomNumber,
        bankCode: formData.bankCode,
        bankName: selectedBank?.name || '',
        accountNumber: formData.accountNumber,
        profileImage: '/default_avatar.jpg',
      };

      if (isSignup) {
        const registered: any = await registerUser(userData);
        // Create subaccount for seller
        if (registered.id && formData.bankCode && formData.accountNumber) {
          try {
            await createSubaccount({
              userId: registered.id,
              businessName: `${registered.firstName || ''} ${registered.lastName || ''}`,
              bankCode: formData.bankCode,
              accountNumber: formData.accountNumber,
            });
            toast.success('Seller account created! You can now receive payments.');
          } catch (subErr: any) {
            toast.error('Could not create seller account: ' + subErr.message);
          }
        }
        onLogin(registered as UserProfile);
      } else {
        const loggedIn = await loginUser(formData.regNumber);
        onLogin(loggedIn as UserProfile);
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1E4A]">
      <div className="w-full px-4 lg:px-8 py-6">
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-4">
            <img src={isSignup ? '/signup_illustration.jpg' : '/login_illustration.jpg'} alt={isSignup ? 'Sign Up' : 'Login'} className="w-40 h-28 object-contain mx-auto" loading="eager" />
          </div>
          <div className="bg-white p-4">
            <div className="text-center mb-3">
              <h1 className="text-lg font-bold text-[#0B1E4A] mb-0.5" style={{ fontFamily: 'Space Grotesk' }}>{isSignup ? 'Create Account' : 'Welcome Back'}</h1>
              <p className="text-[#9CA3AF] text-xs">{isSignup ? 'Join ATBU Marketplace' : 'Sign in to continue'}</p>
            </div>
            <div className="flex bg-[#F6F7F9] p-0.5 mb-4">
              <button onClick={() => setIsSignup(true)} className={`flex-1 py-2 text-xs font-medium transition-colors ${isSignup ? 'bg-[#0B1E4A] text-white' : 'text-[#9CA3AF]'}`}>Sign Up</button>
              <button onClick={() => setIsSignup(false)} className={`flex-1 py-2 text-xs font-medium transition-colors ${!isSignup ? 'bg-[#0B1E4A] text-white' : 'text-[#9CA3AF]'}`}>Log In</button>
            </div>
            {isSignup ? (
              <form onSubmit={handleSubmit} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">First Name</Label><Input required value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="text-xs h-8" /></div>
                  <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Last Name</Label><Input required value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="text-xs h-8" /></div>
                </div>
                <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Registration Number</Label><Input required placeholder="e.g., ATBU/2020/001" value={formData.regNumber} onChange={(e) => setFormData({...formData, regNumber: e.target.value})} className="text-xs h-8" /></div>
                <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Phone Number</Label><Input required type="tel" placeholder="e.g., 08012345678" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="text-xs h-8" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Hostel</Label><Input required placeholder="e.g., Male A" value={formData.hostel} onChange={(e) => setFormData({...formData, hostel: e.target.value})} className="text-xs h-8" /></div>
                  <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Room No.</Label><Input required placeholder="e.g., 205" value={formData.roomNumber} onChange={(e) => setFormData({...formData, roomNumber: e.target.value})} className="text-xs h-8" /></div>
                </div>
                <div className="border-t pt-2">
                  <p className="text-[10px] text-[#9CA3AF] mb-1.5">Payment Details (for receiving money)</p>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-[10px] mb-0.5 block text-[#6B7280]">Bank</Label>
                      <select
                        required
                        value={formData.bankCode}
                        onChange={(e) => setFormData({...formData, bankCode: e.target.value})}
                        className="w-full h-8 px-2 border border-input bg-transparent text-xs rounded-sm"
                      >
                        <option value="">Select Bank</option>
                        {banks.map(bank => (
                          <option key={bank.code} value={bank.code}>{bank.name}</option>
                        ))}
                      </select>
                    </div>
                    <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Account No.</Label><Input required placeholder="e.g., 8012345678" value={formData.accountNumber} onChange={(e) => setFormData({...formData, accountNumber: e.target.value})} className="text-xs h-8" /></div>
                  </div>
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-[#0B1E4A] hover:bg-[#1a3a7a] disabled:opacity-50 text-white py-3 text-sm font-medium transition-colors mt-2 flex items-center justify-center gap-2">
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? 'Please wait...' : 'Create Account'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-2.5">
                <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Registration Number</Label><Input required placeholder="e.g., ATBU/2020/001" value={formData.regNumber} onChange={(e) => setFormData({...formData, regNumber: e.target.value})} className="text-xs h-8" /></div>
                <button type="submit" disabled={isLoading} className="w-full bg-[#0B1E4A] hover:bg-[#1a3a7a] disabled:opacity-50 text-white py-3 text-sm font-medium transition-colors mt-2 flex items-center justify-center gap-2">
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? 'Please wait...' : 'Log In'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sell Page
function SellPage({ user, onNavigate }: { user: UserProfile | null; onNavigate: (page: string) => void }) {
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => { if (event.target?.result) setImages([...images, event.target.result as string]); };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      const product = {
        title,
        price: parseFloat(price),
        image: images[0] || '/trending_textbooks.jpg',
        category,
        seller: `${user.firstName} ${user.lastName[0]}.`,
        sellerId: user.id,
        location: `${user.hostel}, Room ${user.roomNumber}`,
        description,
      };
      await createProduct(product);
      toast.success('Item posted successfully!');
      setImages([]); setTitle(''); setPrice(''); setCategory(''); setDescription('');
      onNavigate('marketplace');
    } catch (error: any) {
      toast.error(error.message || 'Failed to post item');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B1E4A]">
        <div className="flex items-center justify-center px-4 py-12" style={{ minHeight: 'calc(100vh - 56px)' }}>
          <div className="text-center">
            <img src="/login_illustration.jpg" alt="Login" className="w-36 h-28 object-contain mx-auto mb-4" />
            <h1 className="text-lg font-bold text-white mb-2">Please Log In</h1>
            <p className="text-white/60 mb-5 text-sm">You need to be logged in to sell items.</p>
            <button onClick={() => onNavigate('auth')} className="bg-[#2F6BFF] hover:bg-[#1a5aee] text-white px-6 py-3 text-sm font-medium transition-colors">Log In / Sign Up</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <div className="w-full px-4 lg:px-8 py-5">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-[#0B1E4A] flex items-center justify-center mx-auto mb-2"><Camera className="w-6 h-6 text-white" /></div>
            <h1 className="text-base font-bold text-[#0B1E4A] mb-0.5" style={{ fontFamily: 'Space Grotesk' }}>Sell an Item</h1>
            <p className="text-[#9CA3AF] text-xs">Post your item in seconds</p>
          </div>
          <div className="bg-white p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label className="text-[10px] mb-1.5 block text-[#6B7280]">Photos</Label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (<div key={i} className="w-14 h-14 bg-[#F6F7F9] flex-shrink-0"><img src={img} alt={`Upload ${i}`} className="w-full h-full object-cover" /></div>))}
                  <label className="w-14 h-14 border-2 border-dashed border-[#D1D5DB] flex flex-col items-center justify-center cursor-pointer hover:border-[#0B1E4A] transition-colors flex-shrink-0"><Camera className="w-4 h-4 text-[#9CA3AF]" /><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label>
                </div>
              </div>
              <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Title</Label><Input required placeholder="What are you selling?" value={title} onChange={(e) => setTitle(e.target.value)} className="text-xs h-8" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Price (N)</Label><Input required type="number" placeholder="e.g., 5000" value={price} onChange={(e) => setPrice(e.target.value)} className="text-xs h-8" /></div>
                <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Category</Label><select required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-8 px-2 border border-input bg-transparent text-xs"><option value="">Select</option><option value="Textbooks">Textbooks</option><option value="Electronics">Electronics</option><option value="Fashion">Fashion</option><option value="Room Essentials">Room Essentials</option></select></div>
              </div>
              <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Description</Label><textarea required rows={2} placeholder="Describe your item..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-2 py-1.5 border border-input bg-transparent resize-none text-xs" /></div>
              <div className="bg-[#F6F7F9] p-2.5">
                <p className="text-[10px] text-[#9CA3AF] mb-0.5">Your location:</p>
                <p className="text-xs text-[#0B1E4A] font-medium">{user.hostel}, Room {user.roomNumber}</p>
                <p className="text-xs text-[#0B1E4A]">{user.phone}</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-2.5">
                <div className="flex items-start gap-2">
                  <Banknote className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[#6B7280]">You will receive 90% of the sale price. ATBU Marketplace takes a 10% platform fee.</p>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-[#0B1E4A] hover:bg-[#1a3a7a] disabled:opacity-50 text-white py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? 'Posting...' : 'Post Item'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Profile Page
function ProfilePage({ user, setUser, onNavigate }: { user: UserProfile | null; setUser: (user: UserProfile) => void; onNavigate: (page: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<UserProfile | null>(user);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B1E4A]">
        <div className="flex items-center justify-center px-4 py-12" style={{ minHeight: 'calc(100vh - 56px)' }}>
          <div className="text-center">
            <img src="/login_illustration.jpg" alt="Login" className="w-36 h-28 object-contain mx-auto mb-4" />
            <h1 className="text-lg font-bold text-white mb-2">Please Log In</h1>
            <p className="text-white/60 mb-5 text-sm">You need to be logged in to view your profile.</p>
            <button onClick={() => onNavigate('auth')} className="bg-[#2F6BFF] hover:bg-[#1a5aee] text-white px-6 py-3 text-sm font-medium transition-colors">Log In / Sign Up</button>
          </div>
        </div>
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => { if (event.target?.result) setUser({ ...user, profileImage: event.target.result as string }); };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSave = () => { if (editData) { setUser(editData); setIsEditing(false); } };

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <div className="w-full px-4 lg:px-8 py-5">
        <div className="max-w-md mx-auto">
          <div className="bg-white p-4 mb-3">
            <div className="text-center">
              <div className="relative inline-block">
                <img src={user.profileImage || '/default_avatar.jpg'} alt="Profile" className="w-20 h-20 object-cover border-4 border-[#2F6BFF] mx-auto" />
                <label className="absolute bottom-0 right-0 w-7 h-7 bg-[#2F6BFF] flex items-center justify-center cursor-pointer hover:bg-[#1a5aee] transition-colors"><Camera className="w-3.5 h-3.5 text-white" /><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label>
              </div>
              <h1 className="text-lg font-bold text-[#0B1E4A] mt-2" style={{ fontFamily: 'Space Grotesk' }}>{user.firstName} {user.lastName}</h1>
              <p className="text-xs text-[#9CA3AF]">{user.regNumber}</p>
              {user.subaccountCode && (
                <p className="text-[10px] text-green-600 mt-1">✓ Seller account verified</p>
              )}
            </div>
          </div>
          <div className="bg-white p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[#0B1E4A] text-sm">Profile Information</h2>
              <button onClick={() => setIsEditing(!isEditing)} className="text-[#2F6BFF] text-xs flex items-center gap-1 hover:underline">{isEditing ? <><XIcon className="w-3 h-3" /> Cancel</> : <><Edit3 className="w-3 h-3" /> Edit</>}</button>
            </div>
            {isEditing ? (
              <div className="space-y-2.5">
                <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Phone Number</Label><Input value={editData?.phone || ''} onChange={(e) => setEditData({ ...editData!, phone: e.target.value })} className="text-xs h-8" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Hostel</Label><Input value={editData?.hostel || ''} onChange={(e) => setEditData({ ...editData!, hostel: e.target.value })} className="text-xs h-8" /></div>
                  <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Room No.</Label><Input value={editData?.roomNumber || ''} onChange={(e) => setEditData({ ...editData!, roomNumber: e.target.value })} className="text-xs h-8" /></div>
                </div>
                <div className="border-t pt-2">
                  <p className="text-[10px] text-[#9CA3AF] mb-1.5">Payment Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Bank</Label><Input value={editData?.bankName || ''} onChange={(e) => setEditData({ ...editData!, bankName: e.target.value })} className="text-xs h-8" /></div>
                    <div><Label className="text-[10px] mb-0.5 block text-[#6B7280]">Account No.</Label><Input value={editData?.accountNumber || ''} onChange={(e) => setEditData({ ...editData!, accountNumber: e.target.value })} className="text-xs h-8" /></div>
                  </div>
                </div>
                <button onClick={handleSave} className="w-full bg-[#0B1E4A] hover:bg-[#1a3a7a] text-white py-3 text-sm font-medium transition-colors"><Check className="w-4 h-4 inline mr-2" />Save Changes</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100"><div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#9CA3AF]" /><span className="text-xs text-[#9CA3AF]">Phone</span></div><span className="text-sm text-[#0B1E4A]">{user.phone}</span></div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100"><div className="flex items-center gap-2"><Home className="w-4 h-4 text-[#9CA3AF]" /><span className="text-xs text-[#9CA3AF]">Location</span></div><span className="text-sm text-[#0B1E4A]">{user.hostel}, {user.roomNumber}</span></div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100"><div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#9CA3AF]" /><span className="text-xs text-[#9CA3AF]">Bank</span></div><span className="text-sm text-[#0B1E4A]">{user.bankName}</span></div>
                <div className="flex items-center justify-between py-1.5"><div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#9CA3AF]" /><span className="text-xs text-[#9CA3AF]">Account</span></div><span className="text-sm text-[#0B1E4A]">{user.accountNumber}</span></div>
              </div>
            )}
          </div>
          <div className="bg-white p-4">
            <h2 className="font-semibold text-[#0B1E4A] text-sm mb-2">My Listings</h2>
            <p className="text-[#9CA3AF] text-center py-6 text-xs">You haven&apos;t posted any items yet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Safety Page
function SafetyPage() {
  const tips = [
    { title: 'Meet in Public', desc: 'Always meet in public areas on campus like cafeterias, libraries, or faculty blocks.' },
    { title: 'Bring a Friend', desc: 'Consider bringing a friend along when meeting someone for the first time.' },
    { title: 'Verify Identity', desc: 'Ask to see student ID to verify the person is an ATBU student.' },
    { title: 'Daytime Meetings', desc: 'Schedule exchanges during daylight hours when possible.' },
    { title: 'Trust Your Instincts', desc: 'If something feels off, don\'t proceed with the transaction.' },
    { title: 'Keep Records', desc: 'Save all messages and transaction details for your records.' },
  ];

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <div className="w-full px-4 lg:px-8 py-5">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-5">
            <img src="/walkthrough_2.jpg" alt="Safety" className="w-36 h-24 object-contain mx-auto mb-2" />
            <h1 className="text-lg font-bold text-[#0B1E4A] mb-0.5" style={{ fontFamily: 'Space Grotesk' }}>Safety Tips</h1>
            <p className="text-[#9CA3AF] text-xs">Stay safe while trading on campus</p>
          </div>
          <div className="space-y-2">
            {tips.map((tip, i) => (
              <div key={i} className="bg-white p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-[#2F6BFF]/10 flex items-center justify-center"><Shield className="w-3 h-3 text-[#2F6BFF]" /></div>
                  <h3 className="font-semibold text-[#0B1E4A] text-xs">{tip.title}</h3>
                </div>
                <p className="text-xs text-[#6B7280] pl-8">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Support Page
function SupportPage() {
  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <div className="w-full px-4 lg:px-8 py-5">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-5">
            <img src="/walkthrough_3.jpg" alt="Support" className="w-36 h-24 object-contain mx-auto mb-2" />
            <h1 className="text-lg font-bold text-[#0B1E4A] mb-0.5" style={{ fontFamily: 'Space Grotesk' }}>Support</h1>
            <p className="text-[#9CA3AF] text-xs">Need help? We&apos;re here for you.</p>
          </div>
          <div className="bg-white p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#2F6BFF]/10 flex items-center justify-center"><Mail className="w-4 h-4 text-[#2F6BFF]" /></div>
              <div><p className="text-[10px] text-[#9CA3AF]">Email us</p><p className="text-xs text-[#0B1E4A] font-medium">support@atbu.market</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#2F6BFF]/10 flex items-center justify-center"><Phone className="w-4 h-4 text-[#2F6BFF]" /></div>
              <div><p className="text-[10px] text-[#9CA3AF]">Call us</p><p className="text-xs text-[#0B1E4A] font-medium">+234 800 ATBU</p></div>
            </div>
            <div className="border-t pt-3">
              <h3 className="font-semibold text-[#0B1E4A] mb-2 text-xs">Frequently Asked Questions</h3>
              <div className="space-y-2">
                <div><p className="font-medium text-[#0B1E4A] text-xs">How do I post an item?</p><p className="text-[10px] text-[#9CA3AF]">Click &quot;Sell&quot; and fill in the details about what you&apos;re selling.</p></div>
                <div><p className="font-medium text-[#0B1E4A] text-xs">Is it free to use?</p><p className="text-[10px] text-[#9CA3AF]">Yes! ATBU Marketplace is completely free for all students.</p></div>
                <div><p className="font-medium text-[#0B1E4A] text-xs">How do I get paid?</p><p className="text-[10px] text-[#9CA3AF]">Buyers pay through Paystack. You receive 90% directly to your bank account.</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main App Component
function App() {
  const [currentPage, setCurrentPage] = useState('marketplace');
  const [previousPage, setPreviousPage] = useState('marketplace');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>(sampleProducts);
  const [orders, setOrders] = useState<Order[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serverReady, setServerReady] = useState(false);

  const [notifications] = useState<Notification[]>([
    { id: 1, message: 'Your order has been delivered', type: 'order', read: false, date: '2025-01-15' },
    { id: 2, message: 'Payment received for your item', type: 'payment', read: true, date: '2025-01-14' },
  ]);

  // Check server health and load initial data
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;
    
    async function init() {
      try {
        const health = await getHealth();
        if (health.status) {
          setServerReady(true);
          console.log('✅ Backend connected');
          // Seed products if needed
          await seedProducts();
          // Load products
          const prods = await getProducts();
          if (prods.length > 0) setProducts(prods);
          // Load banks
          const bankList = await getBanks();
          setBanks(bankList);
          setIsLoading(false);
          return;
        }
      } catch {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`⏳ Waiting for backend... (${attempts}/${maxAttempts})`);
          setTimeout(init, 1000);
          return;
        }
        console.log('⚠️ Backend not available, running in demo mode');
      }
      setIsLoading(false);
    }
    init();
  }, []);

  // Load user from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('atbu_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, []);

  // Save user to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('atbu_user', JSON.stringify(user));
      loadOrders(user.id);
    } else {
      localStorage.removeItem('atbu_user');
    }
  }, [user]);

  // Handle payment callbacks from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference');
    const callback = params.get('payment_callback');
    const cancel = params.get('payment_cancel');

    if (reference) {
      if (callback) {
        // Verify payment
        verifyPayment(reference)
          .then((data: any) => {
            if (data.status === 'success') {
              toast.success('Payment verified successfully!');
            } else {
              toast.error('Payment was not completed.');
            }
            // Clear URL params
            window.history.replaceState({}, document.title, window.location.pathname);
            setCurrentPage('orders');
          })
          .catch(() => {
            toast.error('Could not verify payment');
            window.history.replaceState({}, document.title, window.location.pathname);
          });
      } else if (cancel) {
        toast.info('Payment was cancelled.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  async function loadOrders(userId: string) {
    if (!serverReady) return;
    try {
      const [bought, sold] = await Promise.all([
        getBuyerOrders(userId),
        getSellerOrders(userId),
      ]);

      // Hydrate orders with product data
      const allOrders: Order[] = [];
      for (const o of bought) {
        const prod = products.find(p => p.id === o.productId) || sampleProducts.find(p => p.id === o.productId);
        if (prod) {
          allOrders.push({
            id: o.id,
            product: prod,
            buyerId: o.buyerId,
            sellerId: o.sellerId,
            buyerName: 'You',
            sellerName: prod.seller,
            status: o.status,
            date: o.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
            type: 'bought',
            reference: o.reference,
            amount: o.amount,
            paidAt: o.paidAt,
          });
        }
      }
      for (const o of sold) {
        const prod = products.find(p => p.id === o.productId) || sampleProducts.find(p => p.id === o.productId);
        if (prod) {
          allOrders.push({
            id: o.id,
            product: prod,
            buyerId: o.buyerId,
            sellerId: o.sellerId,
            buyerName: 'Buyer',
            sellerName: 'You',
            status: o.status,
            date: o.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
            type: 'sold',
            reference: o.reference,
            amount: o.amount,
            paidAt: o.paidAt,
          });
        }
      }
      setOrders(allOrders);
    } catch (e) {
      console.error('Failed to load orders', e);
    }
  }

  const handleNavigate = (page: string) => {
    setPreviousPage(currentPage);
    setCurrentPage(page);
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setPreviousPage(currentPage);
    setCurrentPage('productDetail');
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setPreviousPage(currentPage);
    setCurrentPage('orderDetail');
  };

  const handleBack = () => {
    setCurrentPage(previousPage);
    setSelectedProduct(null);
    setSelectedOrder(null);
  };

  const handleLogin = (userData: UserProfile) => {
    setUser(userData);
    setShowWalkthrough(true);
  };

  const handleWalkthroughComplete = () => {
    setShowWalkthrough(false);
    setCurrentPage('marketplace');
  };

  const refreshOrders = useCallback(() => {
    if (user) loadOrders(user.id);
  }, [user, serverReady, products]);

  const renderPage = () => {
    switch (currentPage) {
      case 'marketplace': return <MarketplacePage products={products} onProductClick={handleProductClick} />;
      case 'productDetail': return selectedProduct ? <ProductDetailPage product={selectedProduct} user={user} onNavigate={handleNavigate} onBack={handleBack} /> : <MarketplacePage products={products} onProductClick={handleProductClick} />;
      case 'orderDetail': return selectedOrder ? <OrderDetailPage order={selectedOrder} user={user} onBack={handleBack} onUpdate={refreshOrders} /> : <OrdersPage user={user} orders={orders} onNavigate={handleNavigate} onOrderClick={handleOrderClick} />;
      case 'orders': return <OrdersPage user={user} orders={orders} onNavigate={handleNavigate} onOrderClick={handleOrderClick} />;
      case 'sell': return <SellPage user={user} onNavigate={handleNavigate} />;
      case 'auth': return <AuthPage onLogin={handleLogin} banks={banks} />;
      case 'profile': return <ProfilePage user={user} setUser={setUser} onNavigate={handleNavigate} />;
      case 'safety': return <SafetyPage />;
      case 'support': return <SupportPage />;
      default: return <MarketplacePage products={products} onProductClick={handleProductClick} />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1E4A]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-3" />
          <p className="text-white text-sm">Loading ATBU Marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      {showWalkthrough && <Walkthrough onComplete={handleWalkthroughComplete} />}
      <Navigation onNavigate={handleNavigate} user={user} notifications={notifications} />
      {!serverReady && (
        <div className="bg-yellow-50 border-b border-yellow-100 px-4 py-2 text-center">
          <p className="text-[10px] text-yellow-700">Backend server not connected. Running in demo mode. Run <code className="bg-yellow-100 px-1">npm run server</code> in another terminal.</p>
        </div>
      )}
      <main>{renderPage()}</main>
    </div>
  );
}

export default App;
