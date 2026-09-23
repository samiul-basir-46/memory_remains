/**
 * Petty Bloom Order Summary & Filter Helpers
 * Matches format: 01333712315 (_laibaa_a_) - A4(1pcs, 20p) ,, 3x3 frame 2p - personal - 1149tk - need 14 September - Cumilla
 */

const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Format delivery date to "14 September"
 */
export function formatNeedDate(dateStr) {
  if (!dateStr) return "N/A";
  try {
    if (typeof dateStr === "string" && dateStr.includes("-")) {
      const parts = dateStr.split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        const [year, month, day] = parts;
        return `${day} ${FULL_MONTH_NAMES[month - 1]}`;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${d.getDate()} ${FULL_MONTH_NAMES[d.getMonth()]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Format products into concise production string
 * e.g. A4(1pcs, 20p) ,, 3x3 frame 2p ,, 20 polaroids
 */
export function formatOrderProductsSummary(order) {
  const f = order.raw?.order_details || order.raw || {};
  const prods = f.prods || (Array.isArray(order.raw?.products) ? order.raw.products : []);
  const parts = [];

  // 1. Magazine
  if (prods.includes('Magazine') || (f.magTypes && f.magTypes.length > 0)) {
    const types = f.magTypes && f.magTypes.length > 0 ? f.magTypes : ['Magazine'];
    types.forEach(type => {
      const count = parseInt(f.magCounts?.[type], 10) || 1;
      const typePages = (f.magPages?.[type] || []).filter(Boolean);
      const pageText = typePages.length > 0 ? typePages.map(p => `${p}p`).join(', ') : '20p';
      parts.push(`${type === 'Magazine' ? 'A4' : type}(${count}pcs, ${pageText})`);
    });
  }

  // 2. Frame
  if (prods.includes('Frame') || (f.frameSizes && f.frameSizes.length > 0)) {
    const frameSizes = f.frameSizes || [];
    const frameQty = f.frameQty || {};
    frameSizes.forEach(size => {
      const qty = frameQty[size] || 1;
      parts.push(`${size} frame ${qty}p`);
    });
  }

  // 3. Polaroid
  if (prods.includes('Polaroid') || f.polaroidQty) {
    const qty = f.polaroidQty || 10;
    parts.push(`${qty} polaroids`);
  }

  // 4. Mini Pocket Magazine
  if (prods.includes('Mini Pocket Magazine') || f.miniQty) {
    const qty = f.miniQty || 1;
    parts.push(`${qty} Mini Pocket Mag`);
  }

  // Fallback for orders from web catalog or structured items
  if (parts.length === 0 && Array.isArray(order.items) && order.items.length > 0) {
    order.items.forEach(it => {
      if (it.productType === 'magazine') {
        const type = it.specs?.type || (it.templateName.includes('A5') ? 'A5' : 'A4');
        const count = it.comboQuantity || 1;
        const pages = it.specs?.pages || (it.templateName.match(/(\d+p)/)?.[1]) || '20p';
        parts.push(`${type}(${count}pcs, ${pages})`);
      } else if (it.productType === 'frame') {
        const sizes = it.specs?.sizes || [];
        if (sizes.length > 0) {
          sizes.forEach(s => {
            const q = it.specs?.quantities?.[s] || 1;
            parts.push(`${s} frame ${q}p`);
          });
        } else {
          parts.push(`${it.templateName}`);
        }
      } else if (it.productType === 'polaroid') {
        parts.push(`${it.comboQuantity || 10} polaroids`);
      } else if (it.productType === 'mini_mag') {
        parts.push(`${it.comboQuantity || 1} Mini Pocket Mag`);
      } else {
        parts.push(it.templateName);
      }
    });
  }

  if (parts.length === 0) {
    parts.push(order.productType || 'Custom Order');
  }

  // Join multiple items with ` ,, ` as requested
  return parts.join(' ,, ');
}

/**
 * Format single order into requested format:
 * 01333712315 (_laibaa_a_) - A4(1pcs, 20p) ,, 3x3 frame 2p - personal - 1149tk - need 14 September - Cumilla
 */
export function formatOrderCopySummary(order) {
  const f = order.raw?.order_details || order.raw || {};
  const phone = (order.whatsappNumber || order.customerPhone || order.contactNumber || 'N/A').trim();
  const rawIg = (order.igUsername || f.ig || '').trim();
  const igUser = rawIg ? rawIg.replace(/^@+/, '') : 'no_ig';
  const productsStr = formatOrderProductsSummary(order);

  // Occasion / Theme
  const rawTheme = ((f.magTheme === 'Other' || f.magTheme === 'Custom') && f.magCustomTheme)
    ? f.magCustomTheme.trim()
    : (f.magTheme || order.occasion || order.raw?.occasion || order.items?.[0]?.occasion || 'personal');
  const theme = (rawTheme || 'personal').trim().toLowerCase();

  // Price (in tk)
  const price = `${order.expectedAmount || 0}tk`;

  // Need Date
  const needDate = formatNeedDate(order.deliveryDate || f.delivDate);

  // City (extract concise city name)
  let city = (order.city || f.city || '').trim();
  if (!city && order.shippingAddress) {
    const parts = order.shippingAddress.split(',').map(s => s.trim());
    city = parts[parts.length - 1] || 'Dhaka';
  }
  if (!city) city = order.location === 'inside' ? 'Dhaka' : 'Outside Dhaka';

  return `${phone} (${igUser}) - ${productsStr} - ${theme} - ${price} - need ${needDate} - ${city}`;
}

/**
 * Check if order matches a product category filter
 */
export function orderHasProduct(order, category) {
  if (!category || category === 'all') return true;
  const cat = category.toLowerCase();

  // Check items array
  if (Array.isArray(order.items) && order.items.length > 0) {
    if (cat === 'magazine' && order.items.some(i => i.productType === 'magazine' || i.templateName.toLowerCase().includes('mag'))) return true;
    if (cat === 'polaroid' && order.items.some(i => i.productType === 'polaroid' || i.templateName.toLowerCase().includes('polaroid'))) return true;
    if (cat === 'frame' && order.items.some(i => i.productType === 'frame' || i.templateName.toLowerCase().includes('frame'))) return true;
    if ((cat === 'mini_mag' || cat === 'mini') && order.items.some(i => i.productType === 'mini_mag' || i.templateName.toLowerCase().includes('mini'))) return true;
  }

  // Check raw form products
  const prods = order.raw?.products || order.raw?.order_details?.prods || [];
  if (Array.isArray(prods)) {
    if (cat === 'magazine' && prods.some(p => p.toLowerCase().includes('magazine'))) return true;
    if (cat === 'polaroid' && prods.some(p => p.toLowerCase().includes('polaroid'))) return true;
    if (cat === 'frame' && prods.some(p => p.toLowerCase().includes('frame'))) return true;
    if ((cat === 'mini_mag' || cat === 'mini') && prods.some(p => p.toLowerCase().includes('mini'))) return true;
  }

  const od = order.raw?.order_details || {};
  if (cat === 'magazine' && (od.magTypes?.length > 0 || od.magTheme)) return true;
  if (cat === 'frame' && od.frameSizes?.length > 0) return true;
  if (cat === 'polaroid' && od.polaroidQty) return true;
  if ((cat === 'mini_mag' || cat === 'mini') && od.miniQty) return true;

  if (order.productType && order.productType.toLowerCase().includes(cat)) return true;
  return false;
}

/**
 * Generate combined summary for all urgent orders
 */
export function generateAllUrgentSummary(orders = []) {
  const urgentOrders = orders.filter(o => 
    o.status !== 'completed' && 
    o.status !== 'cancelled' && 
    (o.urgency?.isUrgent || o.urgency?.isOverdue)
  );

  if (urgentOrders.length === 0) {
    return 'No urgent or overdue orders currently.';
  }

  // Sort by delivery date ascending (closest delivery date first)
  urgentOrders.sort((a, b) => {
    const tA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
    const tB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
    return tA - tB;
  });

  return urgentOrders.map(formatOrderCopySummary).join('\n\n');
}
