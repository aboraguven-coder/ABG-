// =====================
// PRODUCT DATA
// =====================
const products = [
  { id: 1, name: "Smart LED Desk Lamp", category: "Tech", price: 34.99, original: 59.99, emoji: "💡", rating: 4.8, reviews: 1243, badge: "hot", tags: ["popular"] },
  { id: 2, name: "Wireless Noise-Cancelling Earbuds", category: "Tech", price: 49.99, original: 89.99, emoji: "🎧", rating: 4.9, reviews: 3210, badge: "best", tags: ["popular"] },
  { id: 3, name: "Portable Phone Charger 20000mAh", category: "Tech", price: 29.99, original: 49.99, emoji: "🔋", rating: 4.7, reviews: 892, badge: "sale", tags: [] },
  { id: 4, name: "Magnetic Phone Mount", category: "Tech", price: 14.99, original: null, emoji: "📱", rating: 4.6, reviews: 567, badge: "new", tags: [] },
  { id: 5, name: "Smart Watch Fitness Tracker", category: "Tech", price: 59.99, original: 99.99, emoji: "⌚", rating: 4.8, reviews: 2100, badge: "hot", tags: ["popular"] },
  { id: 6, name: "Artisan Scented Candle Set", category: "Home", price: 24.99, original: 39.99, emoji: "🕯️", rating: 4.9, reviews: 788, badge: "new", tags: [] },
  { id: 7, name: "Minimalist Wall Clock", category: "Home", price: 32.99, original: null, emoji: "🕐", rating: 4.7, reviews: 312, badge: null, tags: [] },
  { id: 8, name: "Premium Silk Pillowcase Set", category: "Home", price: 27.99, original: 44.99, emoji: "🛏️", rating: 4.8, reviews: 1045, badge: "sale", tags: [] },
  { id: 9, name: "Compact Air Purifier", category: "Home", price: 44.99, original: 74.99, emoji: "🌿", rating: 4.7, reviews: 654, badge: "hot", tags: ["popular"] },
  { id: 10, name: "Oversized Knit Sweater", category: "Fashion", price: 38.99, original: 64.99, emoji: "🧥", rating: 4.6, reviews: 923, badge: "new", tags: [] },
  { id: 11, name: "Leather Minimalist Wallet", category: "Fashion", price: 22.99, original: null, emoji: "👛", rating: 4.8, reviews: 1560, badge: "best", tags: ["popular"] },
  { id: 12, name: "Sunglasses UV400 Polarized", category: "Fashion", price: 19.99, original: 34.99, emoji: "🕶️", rating: 4.5, reviews: 743, badge: "sale", tags: [] },
  { id: 13, name: "Jade Facial Roller Set", category: "Beauty", price: 16.99, original: 29.99, emoji: "💎", rating: 4.9, reviews: 2340, badge: "hot", tags: ["popular"] },
  { id: 14, name: "Vitamin C Glow Serum", category: "Beauty", price: 21.99, original: 38.99, emoji: "✨", rating: 4.8, reviews: 1876, badge: "best", tags: [] },
  { id: 15, name: "Resistance Band Set", category: "Sports", price: 18.99, original: 29.99, emoji: "🏋️", rating: 4.7, reviews: 1120, badge: "new", tags: [] },
  { id: 16, name: "Yoga Mat Premium Non-Slip", category: "Sports", price: 31.99, original: 54.99, emoji: "🧘", rating: 4.9, reviews: 987, badge: "sale", tags: [] },
  { id: 17, name: "Interactive Pet Feeder", category: "Pets", price: 26.99, original: 44.99, emoji: "🐾", rating: 4.8, reviews: 678, badge: "new", tags: [] },
  { id: 18, name: "Pet Grooming Glove", category: "Pets", price: 12.99, original: null, emoji: "🐶", rating: 4.7, reviews: 1234, badge: null, tags: [] },
];

const deals = [
  { id: 101, name: "Smart LED Strip Lights (5m)", price: 18.99, original: 49.99, pct: 62, emoji: "🌈", sold: 78, total: 100 },
  { id: 102, name: "Bluetooth 5.0 Mini Speaker", price: 22.99, original: 59.99, pct: 62, emoji: "🔊", sold: 65, total: 80 },
  { id: 103, name: "Electric Posture Corrector", price: 29.99, original: 79.99, pct: 63, emoji: "🦺", sold: 42, total: 60 },
  { id: 104, name: "Anti-Gravity Phone Case", price: 14.99, original: 39.99, pct: 63, emoji: "📲", sold: 91, total: 100 },
];

// =====================
// CART STATE
// =====================
let cart = JSON.parse(localStorage.getItem('novadrop_cart') || '[]');
let currentFilter = 'all';
let searchQuery = '';

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  renderDeals();
  updateCartUI();
  startCountdowns();
  initScrollEffects();
});

// =====================
// RENDER PRODUCTS
// =====================
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  let filtered = products;

  if (currentFilter !== 'all') {
    filtered = filtered.filter(p => p.category === currentFilter);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text2)">
      <div style="font-size:3rem;margin-bottom:16px">🔍</div>
      <p>No products found. Try a different search or filter.</p>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="product-card" data-id="${p.id}">
      <div class="product-image">
        ${p.badge ? `<span class="product-badge badge-${p.badge}">${badgeLabel(p.badge)}</span>` : ''}
        <button class="wishlist-btn" onclick="wishlist(event, ${p.id})">♡</button>
        <span style="font-size:4rem;position:relative">${p.emoji}</span>
      </div>
      <div class="product-info">
        <div class="product-category">${p.category}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-rating">
          <span class="stars-small">${renderStars(p.rating)}</span>
          <span class="rating-count">${p.rating} (${p.reviews.toLocaleString()})</span>
        </div>
        <div class="product-price-row">
          <div class="price-group">
            <span class="price">$${p.price.toFixed(2)}</span>
            ${p.original ? `<span class="price-original">$${p.original.toFixed(2)}</span>` : ''}
            ${p.original ? `<span class="price-save">Save $${(p.original - p.price).toFixed(2)}</span>` : ''}
          </div>
          <button class="add-to-cart" onclick="addToCart(event, ${p.id})">+ Add</button>
        </div>
      </div>
    </div>
  `).join('');
}

function badgeLabel(badge) {
  return { hot: '🔥 Hot', new: '✨ New', sale: '🏷 Sale', best: '⭐ Best' }[badge] || badge;
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}

// =====================
// RENDER DEALS
// =====================
function renderDeals() {
  const grid = document.getElementById('dealsGrid');
  grid.innerHTML = deals.map(d => `
    <div class="deal-card">
      <div class="deal-header">
        <span class="deal-tag">🔥 FLASH DEAL</span>
        <span class="deal-countdown" id="countdown-${d.id}">Loading...</span>
      </div>
      <div class="deal-image">${d.emoji}</div>
      <div class="deal-info">
        <div class="deal-name">${d.name}</div>
        <div class="deal-prices">
          <span class="deal-price">$${d.price.toFixed(2)}</span>
          <span class="deal-original">$${d.original.toFixed(2)}</span>
          <span class="deal-pct">-${d.pct}%</span>
        </div>
        <div class="deal-progress">
          <div class="deal-progress-text">
            <span>${d.sold} sold</span>
            <span>${d.total - d.sold} left!</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${(d.sold/d.total)*100}%"></div>
          </div>
        </div>
        <button class="deal-btn" onclick="addDealToCart(${d.id})">Grab This Deal →</button>
      </div>
    </div>
  `).join('');
}

// =====================
// COUNTDOWNS
// =====================
function startCountdowns() {
  const ends = {};
  deals.forEach((d, i) => {
    const now = Date.now();
    ends[d.id] = now + (3 + i) * 3600 * 1000 + (i * 23 + 14) * 60000;
  });

  function tick() {
    deals.forEach(d => {
      const el = document.getElementById(`countdown-${d.id}`);
      if (!el) return;
      const rem = ends[d.id] - Date.now();
      if (rem <= 0) { el.textContent = 'EXPIRED'; return; }
      const h = Math.floor(rem / 3600000);
      const m = Math.floor((rem % 3600000) / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      el.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
    });
  }

  tick();
  setInterval(tick, 1000);
}

function pad(n) { return String(n).padStart(2, '0'); }

// =====================
// FILTER & SEARCH
// =====================
function setFilter(btn, cat) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = cat;
  renderProducts();
}

function filterByCategory(cat) {
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.trim() === cat || (b.textContent.trim() === 'All' && cat === 'all'));
  });
  document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
  renderProducts();
}

function filterProducts() {
  searchQuery = document.getElementById('searchInput').value;
  renderProducts();
}

// =====================
// CART LOGIC
// =====================
function addToCart(event, productId) {
  event.stopPropagation();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(i => i.id === productId);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, emoji: product.emoji, qty: 1 });
  }

  saveCart();
  updateCartUI();
  showToast(`✅ ${product.name} added to cart!`);
}

function addDealToCart(dealId) {
  const deal = deals.find(d => d.id === dealId);
  if (!deal) return;

  const existing = cart.find(i => i.id === dealId);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: deal.id, name: deal.name, price: deal.price, emoji: deal.emoji, qty: 1 });
  }

  saveCart();
  updateCartUI();
  showToast(`🔥 ${deal.name} added to cart!`);
  toggleCart();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.id !== id);
  }
  saveCart();
  updateCartUI();
}

function removeItem(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  updateCartUI();
}

function saveCart() {
  localStorage.setItem('novadrop_cart', JSON.stringify(cart));
}

function updateCartUI() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartCount').textContent = total;
  document.getElementById('cartItemCount').textContent = `(${total} ${total === 1 ? 'item' : 'items'})`;

  const cartItemsEl = document.getElementById('cartItems');
  const emptyEl = document.getElementById('cartEmpty');
  const footerEl = document.getElementById('cartFooter');
  const totalEl = document.getElementById('cartTotal');

  if (cart.length === 0) {
    emptyEl.style.display = 'flex';
    footerEl.style.display = 'none';
    cartItemsEl.innerHTML = '';
    cartItemsEl.appendChild(emptyEl);
    return;
  }

  emptyEl.style.display = 'none';
  footerEl.style.display = 'block';

  cartItemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-icon">${item.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
          <button class="remove-btn" onclick="removeItem(${item.id})">✕ Remove</button>
        </div>
      </div>
    </div>
  `).join('');

  const grandTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  totalEl.textContent = `$${grandTotal.toFixed(2)}`;
}

// =====================
// UI TOGGLES
// =====================
function toggleCart() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  drawer.classList.toggle('open');
  overlay.classList.toggle('open');
  document.body.style.overflow = drawer.classList.contains('open') ? 'hidden' : '';
}

function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

function toggleSearch() {
  const bar = document.getElementById('searchBar');
  bar.classList.toggle('open');
  if (bar.classList.contains('open')) {
    document.getElementById('searchInput').focus();
  }
}

// =====================
// TOAST
// =====================
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// =====================
// CHECKOUT
// =====================
function handleCheckout() {
  if (cart.length === 0) return;
  showToast('🚀 Redirecting to checkout...');
  setTimeout(() => {
    alert('Thank you for shopping at NovaDrop!\n\nIn a live store, this would redirect to your payment processor.\n\nOrder total: $' + cart.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2));
    cart = [];
    saveCart();
    updateCartUI();
    toggleCart();
  }, 1500);
}

// =====================
// NEWSLETTER
// =====================
function handleSubscribe(event) {
  event.preventDefault();
  const input = event.target.querySelector('input');
  showToast(`🎉 You're subscribed with ${input.value}!`);
  input.value = '';
}

// =====================
// WISHLIST
// =====================
function wishlist(event, productId) {
  event.stopPropagation();
  const product = products.find(p => p.id === productId);
  showToast(`❤️ ${product.name} added to wishlist!`);
}

// =====================
// SCROLL EFFECTS
// =====================
function initScrollEffects() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      navbar.style.background = 'rgba(8,9,15,0.97)';
    } else {
      navbar.style.background = 'rgba(8,9,15,0.85)';
    }
  });

  // Animate elements on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.product-card, .cat-card, .deal-card, .trust-item, .testimonial-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}
