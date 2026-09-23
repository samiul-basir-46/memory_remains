import { getFirebaseServices, getFormDb } from '../services/firebase-service.js';
import { adminState } from './admin-state.js';
import { createSteadfastOrder } from '../services/steadfast-service.js';

/**
 * Helper to convert Firestore REST API fields structure to plain JS object
 */
export function parseFirestoreRestFields(fields) {
  if (!fields) return {};
  const res = {};
  for (const [key, valObj] of Object.entries(fields)) {
    if (!valObj) continue;
    if ('stringValue' in valObj) res[key] = valObj.stringValue;
    else if ('integerValue' in valObj) res[key] = Number(valObj.integerValue);
    else if ('doubleValue' in valObj) res[key] = Number(valObj.doubleValue);
    else if ('booleanValue' in valObj) res[key] = Boolean(valObj.booleanValue);
    else if ('timestampValue' in valObj) res[key] = new Date(valObj.timestampValue);
    else if ('nullValue' in valObj) res[key] = null;
    else if ('arrayValue' in valObj) {
      res[key] = (valObj.arrayValue?.values || []).map(v => {
        if ('stringValue' in v) return v.stringValue;
        if ('integerValue' in v) return Number(v.integerValue);
        if ('doubleValue' in v) return Number(v.doubleValue);
        if ('booleanValue' in v) return Boolean(v.booleanValue);
        if ('mapValue' in v) return parseFirestoreRestFields(v.mapValue?.fields);
        return v;
      });
    } else if ('mapValue' in valObj) {
      res[key] = parseFirestoreRestFields(valObj.mapValue?.fields);
    }
  }
  return res;
}

export class AdminApiService {
  constructor() {
    const { db, auth } = getFirebaseServices();
    this.db = db;
    this.auth = auth;
    this.formDb = null;
  }

  getDb() {
    if (!this.db) {
      const { db } = getFirebaseServices();
      this.db = db;
    }
    return this.db;
  }

  getFormDb() {
    if (!this.formDb) {
      this.formDb = getFormDb();
    }
    return this.formDb;
  }

  /**
   * Directly fetch all orders from pettybloomform REST endpoint (guaranteed to succeed without CORS/auth blockers)
   */
  async fetchFormOrdersRest() {
    try {
      const url = 'https://firestore.googleapis.com/v1/projects/pettybloomform/databases/(default)/documents/orders?pageSize=300';
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      const docs = json.documents || [];
      return docs.map(d => this.normalizeOrder(d));
    } catch (err) {
      console.warn('REST fetch pettybloomform orders notice:', err.message);
      return [];
    }
  }

  /**
   * Helper to normalize Firestore order doc (supports both Web Cart purchases and Custom Form orders, via SDK or REST)
   */
  normalizeOrder(doc) {
    let data = {};
    let id = '';

    if (doc.fields && typeof doc.name === 'string') {
      id = doc.name.split('/').pop();
      data = parseFirestoreRestFields(doc.fields);
    } else if (typeof doc.data === 'function') {
      data = doc.data() || {};
      id = doc.id;
    } else {
      data = doc.data || doc;
      id = doc.id || doc._id || '';
    }

    // Dates
    let createdAt = new Date();
    if (data.createdAt?.toDate) createdAt = data.createdAt.toDate();
    else if (data.created_at?.toDate) createdAt = data.created_at.toDate();
    else if (data.createdAt) createdAt = new Date(data.createdAt);
    else if (data.created_at) createdAt = new Date(data.created_at);
    else if (data.date) {
      const d = new Date(data.date);
      if (!isNaN(d.getTime())) createdAt = d;
    }

    // Customer & Recipient Details
    const customerName = (data.customerName || data.customer_name || data.name || data.recipient_name || 'Anonymous').trim();
    const customerPhone = data.customerPhone || data.customer_phone || data.whatsapp_number || data.contact_number || data.recipient_phone || '';
    const whatsappNumber = data.whatsapp_number || data.whatsapp || data.order_details?.whatsapp || customerPhone || '';
    const contactNumber = data.contact_number || data.contact || data.order_details?.contact || customerPhone || '';
    const rawIg = data.ig_username || data.instagram || data.order_details?.ig || '';
    const igUsername = typeof rawIg === 'string' ? rawIg.trim().replace(/^@/, '') : '';
    const recipientName = (data.recipient_name || data.recipient || data.order_details?.recipient || customerName).trim();

    // Shipping Address & Delivery
    let shippingAddress = data.shippingAddress || data.recipient_address || data.deliveryAddress || data.address || '';
    const city = (data.city || data.order_details?.city || '').trim();
    if (city && !shippingAddress.toLowerCase().includes(city.toLowerCase())) {
      shippingAddress = shippingAddress ? `${shippingAddress}, ${city}` : city;
    }
    const location = (data.location || data.order_details?.location || '').toLowerCase(); // 'inside' | 'outside'
    const deliveryDate = data.delivery_date || data.delivDate || data.deliveryDate || data.order_details?.delivDate || '';

    // Urgency Calculation (Matching petty_bloom_form urgency.js)
    let isUrgent = false;
    let isOverdue = false;
    let daysRemaining = null;
    let urgencyText = '';
    if (deliveryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parts = String(deliveryDate).split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        const target = new Date(parts[0], parts[1] - 1, parts[2]);
        target.setHours(0, 0, 0, 0);
        daysRemaining = Math.round((target - today) / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) {
          isOverdue = true;
          isUrgent = true;
          urgencyText = `🚨 Overdue by ${Math.abs(daysRemaining)}d (${deliveryDate})`;
        } else if (daysRemaining === 0) {
          isUrgent = true;
          urgencyText = `🚨 Due Today (${deliveryDate})`;
        } else if (daysRemaining === 1) {
          isUrgent = true;
          urgencyText = `🔥 Tomorrow (${deliveryDate})`;
        } else if (location.includes('out') ? daysRemaining <= 3 : daysRemaining <= 1) {
          isUrgent = true;
          urgencyText = `🔥 In ${daysRemaining}d (${deliveryDate})`;
        } else {
          urgencyText = `📅 In ${daysRemaining}d (${deliveryDate})`;
        }
      }
    }

    // Financials
    const expectedAmount = Number(data.expectedAmount ?? data.totalAmount ?? data.total_price ?? data.total ?? data.totalPrice ?? 0);
    const deliveryCharge = Number(data.deliveryCharge ?? data.delivery_charge ?? (location.includes('out') ? 110 : (location.includes('in') ? 60 : 0)));
    const productAmount = Number(data.productAmount ?? data.subtotal ?? (expectedAmount > deliveryCharge ? expectedAmount - deliveryCharge : expectedAmount));
    const receivedAmount = data.receivedAmount ? Number(data.receivedAmount) : null;
    const paymentMethod = data.paymentMethod || data.payment_method || (data.status === 'completed' || data.status === 'paid' ? 'Paid / Online' : 'Cash on Delivery (COD)');
    const trxId = data.trxId || data.trx_id || data.transactionId || '';

    // Status Normalization
    let status = (data.status || 'pending').toLowerCase();
    if (status === 'in_progress') status = 'preparing';

    // Structured Products & Items
    const rawItems = Array.isArray(data.items) ? data.items : [];
    let items = [];

    if (rawItems.length > 0) {
      items = rawItems.map(item => ({
        itemId: item.item_id || item.itemId || '',
        templateId: item.template_id || item.templateId || '',
        templateName: item.template_name || item.templateName || item.title || 'Item',
        productType: item.product_type || item.productType || data.productType || 'magazine',
        recipientName: item.recipient_name || item.recipientName || recipientName,
        requiredPhotoCount: item.required_photo_count || item.photo_count || 10,
        photosUploaded: Boolean(item.photos_uploaded || item.photosUploaded || (item.photo_urls && item.photo_urls.length > 0)),
        canvaLink: item.canva_link || item.canvaUrl || item.canva_url || '',
        photoUrls: item.photo_urls || item.imageUrls || item.photoUrls || [],
        customizationType: item.customization_type || item.customizationType || 'catalog',
        specs: item.specs || item.specifications || item.variant || {},
        comboQuantity: item.combo_quantity || item.comboQuantity || item.quantity || 1,
        selectedPosters: item.selected_posters || item.selectedPosters || [],
        coverPhotoUrl: item.cover_url || item.coverPhotoUrl || item.cover_photo_url || '',
        backPhotoUrl: item.back_url || item.backPhotoUrl || item.back_photo_url || '',
        innerPhotoUrls: item.inner_urls || item.innerPhotoUrls || item.inner_photo_urls || [],
        pageCount: item.page_count || item.pageCount || item.pages || null,
        occasion: item.occasion || item.category || ''
      }));
    } else if (data.order_details || Array.isArray(data.products)) {
      const od = data.order_details || {};
      const prods = Array.isArray(data.products) ? data.products : (od.prods || []);

      // 1. Magazine
      if (prods.includes('Magazine') || (od.magTypes && od.magTypes.length > 0)) {
        const types = od.magTypes && od.magTypes.length > 0 ? od.magTypes : ['Magazine'];
        const theme = (od.magTheme === 'Custom' || od.magTheme === 'Other') && od.magCustomTheme ? od.magCustomTheme : (od.magTheme || '');
        types.forEach(type => {
          const pageList = (od.magPages?.[type] || []).filter(Boolean).map(p => `${p}p`).join(', ');
          const count = od.magCounts?.[type] || 1;
          items.push({
            itemId: `mag_${type}`,
            templateName: `${count > 1 ? `${count}x ` : ''}${type} Magazine${pageList ? ` (${pageList})` : ''}`,
            productType: 'magazine',
            recipientName: recipientName,
            occasion: theme,
            comboQuantity: Number(count) || 1,
            specs: { theme, pages: pageList, type, isUrgentMag: od.isUrgentMag || false },
            photoUrls: []
          });
        });
      }

      // 2. Polaroid
      if (prods.includes('Polaroid') || od.polaroidQty) {
        const qty = od.polaroidQty || 9;
        const polaroidPhotos = data.photos?.polaroid || od.photos?.polaroid || [];
        items.push({
          itemId: 'polaroid',
          templateName: `Polaroid Prints (${qty}x)`,
          productType: 'polaroid',
          recipientName: recipientName,
          comboQuantity: Number(qty) || 1,
          photoUrls: Array.isArray(polaroidPhotos) ? polaroidPhotos.filter(p => typeof p === 'string') : [],
          specs: { quantity: qty }
        });
      }

      // 3. Frame
      if (prods.includes('Frame') || (od.frameSizes && od.frameSizes.length > 0)) {
        const sizes = od.frameSizes || [];
        const framePhotos = data.photos?.frames || od.photos?.frames || [];
        const sizeStr = sizes.map(s => `${s}" (${od.frameQty?.[s] || 1})`).join(', ');
        items.push({
          itemId: 'frame',
          templateName: `Photo Frame: ${sizeStr || 'Selected Sizes'}`,
          productType: 'frame',
          recipientName: recipientName,
          photoUrls: Array.isArray(framePhotos) ? framePhotos.map(f => (typeof f === 'string' ? f : f?.url)).filter(Boolean) : [],
          specs: { sizes, quantities: od.frameQty || {} }
        });
      }

      // 4. Mini Pocket Magazine
      if (prods.includes('Mini Pocket Magazine') || od.miniQty) {
        const qty = od.miniQty || 1;
        const miniPhotos = data.photos?.miniMag || od.photos?.miniMag || [];
        const miniUrls = Array.isArray(miniPhotos) ? miniPhotos.flatMap(b => (b?.urls || b?.files || [])).filter(u => typeof u === 'string') : [];
        items.push({
          itemId: 'mini_mag',
          templateName: `Mini Pocket Magazine (${qty} Booklet${qty > 1 ? 's' : ''})`,
          productType: 'mini_mag',
          recipientName: recipientName,
          comboQuantity: Number(qty) || 1,
          photoUrls: miniUrls,
          specs: { booklets: qty }
        });
      }
    }

    // Consolidated Photo URLs Collection
    const photoUrlsSet = new Set();
    const addUrl = u => { if (typeof u === 'string' && u.startsWith('http')) photoUrlsSet.add(u); };

    if (Array.isArray(data.imageUrls)) data.imageUrls.forEach(addUrl);
    if (Array.isArray(data.photo_urls)) data.photo_urls.forEach(addUrl);
    if (Array.isArray(data.photoUrls)) data.photoUrls.forEach(addUrl);
    if (Array.isArray(data.photos?.all)) data.photos.all.forEach(addUrl);
    if (Array.isArray(data.photos?.polaroid)) data.photos.polaroid.forEach(addUrl);
    if (Array.isArray(data.photos?.frames)) data.photos.frames.forEach(f => addUrl(typeof f === 'string' ? f : f?.url));
    if (Array.isArray(data.photos?.miniMag)) data.photos.miniMag.forEach(m => (m?.urls || []).forEach(addUrl));
    if (Array.isArray(data.photos?.magazine)) data.photos.magazine.forEach(m => (m?.urls || []).forEach(addUrl));
    if (Array.isArray(data.order_details?.photos?.all)) data.order_details.photos.all.forEach(addUrl);
    if (Array.isArray(data.order_details?.photos?.polaroid)) data.order_details.photos.polaroid.forEach(addUrl);
    if (Array.isArray(data.order_details?.photos?.frames)) data.order_details.photos.frames.forEach(f => addUrl(typeof f === 'string' ? f : f?.url));
    if (Array.isArray(data.order_details?.photos?.miniMag)) data.order_details.photos.miniMag.forEach(m => (m?.urls || []).forEach(addUrl));
    if (Array.isArray(data.order_details?.photos?.magazine)) data.order_details.photos.magazine.forEach(m => (m?.urls || []).forEach(addUrl));
    items.forEach(it => (it.photoUrls || []).forEach(addUrl));

    const photoUrls = Array.from(photoUrlsSet);

    // Courier & Steadfast Information
    const steadfast = data.steadfast || null;
    const trackingNumber = data.trackingNumber || data.tracking_code || data.consignment_id || steadfast?.tracking_code || '';
    const courierName = data.courierName || data.courier_name || (trackingNumber ? 'Steadfast Courier' : '');
    // Source Tag
    const orderSource = (data.order_details || data.products || data.ig_username) ? 'form' : 'web';

    // Clean, human-friendly Order Code (e.g. PB-74JSIN)
    let orderCode = id;
    if (data.order_number || data.orderNumber) {
      orderCode = `PB-${data.order_number || data.orderNumber}`;
    } else if (id && id.length > 8) {
      orderCode = `PB-${id.substring(0, 6).toUpperCase()}`;
    } else if (id) {
      orderCode = id.toUpperCase().startsWith('PB-') ? id.toUpperCase() : `PB-${id.toUpperCase()}`;
    }

    return {
      orderId: id,
      orderCode: orderCode,
      customerName: customerName,
      customerPhone: customerPhone,
      whatsappNumber: whatsappNumber,
      contactNumber: contactNumber,
      igUsername: igUsername,
      customerEmail: data.customerEmail || data.customer_email || data.email || '',
      shippingAddress: shippingAddress,
      city: city,
      location: location,
      deliveryDate: deliveryDate,
      urgency: { isUrgent, isOverdue, daysRemaining, text: urgencyText },
      deliveryNote: data.deliveryNote || data.note || data.notes || '',
      productAmount: productAmount,
      deliveryCharge: deliveryCharge,
      expectedAmount: expectedAmount,
      receivedAmount: receivedAmount,
      paymentMethod: paymentMethod,
      trxId: trxId,
      status: status,
      flagReason: data.flagReason || data.flag_reason || '',
      adminNote: data.adminNote || data.admin_note || '',
      productType: data.productType || data.type || (items[0]?.productType) || 'magazine',
      templateName: data.templateName || data.template_title || (items[0]?.templateName) || '',
      photosUploaded: Boolean(data.photosUploaded || data.photos_uploaded || photoUrls.length > 0),
      photoUrls: photoUrls,
      structuredPhotos: data.photos || data.order_details?.photos || null,
      items: items,
      courierName: courierName,
      trackingNumber: trackingNumber,
      steadfastConsignment: steadfast,
      canvaLink: data.canvaLink || data.canva_link || (items[0]?.canvaLink) || '',
      createdAt: createdAt,
      orderSource: orderSource,
      raw: data
    };
  }

  /**
   * Status groupings matching Petty Bloom admin workflow
   */
  static STATUS_GROUPS = {
    pending: ['pending', 'awaiting_trx'],
    paid: ['paid', 'confirmed', 'preparing', 'shipped', 'delivered', 'in_progress'],
    completed: ['completed', 'delivered'],
    cancelled: ['cancelled', 'rejected'],
    flagged: ['flagged']
  };

  /**
   * Listen to orders by status in real-time across both Databases (Petty-Bloom & PettyBloomForm)
   */
  watchOrders(status, onUpdate, onError) {
    const db = this.getDb();
    const formDb = this.getFormDb();
    const targetGroup = AdminApiService.STATUS_GROUPS[status.toLowerCase()];

    // Cache to merge orders by ID
    const ordersMap = new Map();

    const emitMergedOrders = () => {
      const list = [];
      ordersMap.forEach(order => {
        const orderStatus = (order.status || 'pending').toLowerCase();
        if (status === 'all') {
          list.push(order);
        } else if (targetGroup) {
          if (targetGroup.includes(orderStatus)) {
            list.push(order);
          }
        } else if (orderStatus === status.toLowerCase()) {
          list.push(order);
        }
      });

      // Sort descending by createdAt
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onUpdate(list);
    };

    const unsubs = [];

    // 1. Listen to 'purchases' in default db (petty-bloom)
    if (db) {
      try {
        const u1 = db.collection('purchases').onSnapshot(
          snapshot => {
            snapshot.forEach(doc => ordersMap.set(doc.id, this.normalizeOrder(doc)));
            emitMergedOrders();
          },
          err => console.warn('Purchases watch notice:', err.message)
        );
        unsubs.push(u1);
      } catch (err) {
        console.warn('Error attaching purchases snapshot:', err);
      }

      // 2. Listen to 'orders' in default db (petty-bloom)
      try {
        const u2 = db.collection('orders').onSnapshot(
          snapshot => {
            snapshot.forEach(doc => ordersMap.set(doc.id, this.normalizeOrder(doc)));
            emitMergedOrders();
          },
          err => console.warn('Orders watch notice:', err.message)
        );
        unsubs.push(u2);
      } catch (err) {
        console.warn('Error attaching orders snapshot:', err);
      }
    }

    // 3. Listen to 'orders' in formDb (pettybloomform live submissions)
    if (formDb) {
      try {
        const u3 = formDb.collection('orders').onSnapshot(
          snapshot => {
            snapshot.forEach(doc => ordersMap.set(doc.id, this.normalizeOrder(doc)));
            emitMergedOrders();
          },
          err => {
            console.warn('FormDb live orders watch notice:', err.message);
            if (onError && !unsubs.length) onError(err);
          }
        );
        unsubs.push(u3);
      } catch (err) {
        console.warn('Error attaching formDb snapshot:', err);
      }
    }

    // 4. Guaranteed REST sync & polling from pettybloomform
    const syncFromRest = async () => {
      try {
        const restOrders = await this.fetchFormOrdersRest();
        if (restOrders && restOrders.length > 0) {
          restOrders.forEach(o => ordersMap.set(o.orderId, o));
          emitMergedOrders();
        }
      } catch (e) {
        console.warn('REST poll notice:', e);
      }
    };
    syncFromRest();
    const intervalId = setInterval(syncFromRest, 5000);
    unsubs.push(() => clearInterval(intervalId));

    return () => {
      unsubs.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }


  /**
   * Update order status with dual write to purchases and orders,
   * including stage timestamps and Steadfast auto-booking.
   */
  async updateOrderStatus(orderId, newStatus, adminNote = '', additionalData = {}) {
    const db = this.getDb();
    if (!db) throw new Error('Firestore not initialized');

    const s = newStatus.toLowerCase();
    const nowIso = new Date().toISOString();
    const updatePayload = {
      status: s,
      paymentStatus: (s === 'paid' || s === 'confirmed') ? 'paid' : s,
      payment_status: (s === 'paid' || s === 'confirmed') ? 'paid' : s,
      admin_note: adminNote,
      adminNote: adminNote,
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      ...additionalData
    };

    if (s === 'confirmed' || s === 'paid') {
      updatePayload.confirmed_at = firebase.firestore.FieldValue.serverTimestamp();
      updatePayload.confirmedAt = nowIso;
    } else if (s === 'preparing') {
      updatePayload.prepared_at = firebase.firestore.FieldValue.serverTimestamp();
      updatePayload.preparedAt = nowIso;
    } else if (s === 'shipped') {
      updatePayload.shipped_at = firebase.firestore.FieldValue.serverTimestamp();
      updatePayload.shippedAt = nowIso;

      // Auto-book Steadfast Courier if tracking number is missing
      const providedTracking = additionalData.trackingNumber || additionalData.tracking_code;
      if (!providedTracking) {
        try {
          const docSnap = await db.collection('purchases').doc(orderId).get();
          const existingData = docSnap.exists ? docSnap.data() : null;
          let existingTracking = existingData?.steadfast_tracking_code || existingData?.tracking_number || existingData?.trackingNumber;
          
          if (!existingTracking && existingData) {
            const custName = existingData.customerName || existingData.customer_name || 'Customer';
            const custPhone = existingData.customerPhone || existingData.customer_phone || '';
            let fullAddress = 'Dhaka';
            const rawAddr = existingData.shippingAddress || existingData.deliveryAddress || existingData.address;
            if (typeof rawAddr === 'string' && rawAddr.trim()) {
              fullAddress = rawAddr.trim();
            } else if (rawAddr && typeof rawAddr === 'object') {
              fullAddress = [rawAddr.address, rawAddr.upazila, rawAddr.district].filter(Boolean).join(', ');
            }
            const expectedAmt = Number(existingData.expectedAmount || existingData.totalAmount || 0);
            const receivedAmt = Number(existingData.receivedAmount || 0);
            const payMethod = String(existingData.paymentMethod || existingData.payment_method || '').toLowerCase();
            let codAmt = 0;
            if (payMethod.includes('cod')) {
              codAmt = expectedAmt - receivedAmt;
              if (codAmt < 0) codAmt = 0;
            }
            const prodName = existingData.templateName || existingData.productType || 'Petty Bloom Custom Item';

            if (custPhone) {
              const sfRes = await createSteadfastOrder({
                invoice: orderId,
                recipient_name: custName,
                recipient_phone: custPhone,
                recipient_address: fullAddress,
                cod_amount: codAmt,
                item_description: prodName,
                note: adminNote || ''
              });

              if (sfRes && sfRes.success && sfRes.consignment) {
                updatePayload.trackingNumber = sfRes.consignment.tracking_code;
                updatePayload.tracking_code = sfRes.consignment.tracking_code;
                updatePayload.courierName = 'Steadfast Courier';
                updatePayload.courier_name = 'Steadfast Courier';
                updatePayload.steadfast_consignment = sfRes.consignment;
              }
            }
          }
        } catch (sfErr) {
          console.warn('Steadfast auto-booking warning:', sfErr);
        }
      } else {
        updatePayload.courierName = additionalData.courierName || 'Steadfast Courier';
        updatePayload.trackingNumber = providedTracking;
      }
    } else if (s === 'completed' || s === 'delivered') {
      updatePayload.delivered_at = firebase.firestore.FieldValue.serverTimestamp();
      updatePayload.deliveredAt = nowIso;
    }

    const purchasesRef = db.collection('purchases').doc(orderId);
    const ordersRef = db.collection('orders').doc(orderId);

    const batch = db.batch();
    batch.set(purchasesRef, updatePayload, { merge: true });
    batch.set(ordersRef, updatePayload, { merge: true });
    await batch.commit();

    // Dual-write to formDb (pettybloomform live orders collection)
    const formDb = this.getFormDb();
    if (formDb) {
      try {
        await formDb.collection('orders').doc(orderId).set(updatePayload, { merge: true });
      } catch (err) {
        console.warn('formDb order status update notice:', err.message);
      }
    }

    // Also patch REST to pettybloomform as guaranteed backup
    try {
      fetch(`https://firestore.googleapis.com/v1/projects/pettybloomform/databases/(default)/documents/orders/${encodeURIComponent(orderId)}?updateMask.fieldPaths=status&updateMask.fieldPaths=updated_at`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            status: { stringValue: s },
            updated_at: { stringValue: nowIso }
          }
        })
      }).catch(() => {});
    } catch (_) {}

    return true;
  }

  /**
   * Delete order completely (with confirmation across all databases)
   */
  async deleteOrder(orderId) {
    const db = this.getDb();
    if (!db) throw new Error('Firestore not initialized');

    const batch = db.batch();
    batch.delete(db.collection('purchases').doc(orderId));
    batch.delete(db.collection('orders').doc(orderId));
    await batch.commit();

    // Also delete from formDb (pettybloomform)
    const formDb = this.getFormDb();
    if (formDb) {
      try {
        await formDb.collection('orders').doc(orderId).delete();
      } catch (err) {
        console.warn('formDb delete order notice:', err.message);
      }
    }

    return true;
  }

  /**
   * Watch Unmatched Payments (bKash/Nagad SMS entries where used == false)
   */
  watchUnmatchedPayments(onUpdate, onError) {
    const db = this.getDb();
    if (!db) return () => {};

    return db.collection('payments').where('used', '==', false).onSnapshot(snapshot => {
      const payments = [];
      snapshot.forEach(doc => {
        const d = doc.data() || {};
        let receivedAt = new Date();
        if (d.received_at?.toDate) receivedAt = d.received_at.toDate();
        else if (d.receivedAt?.toDate) receivedAt = d.receivedAt.toDate();
        else if (d.received_at) receivedAt = new Date(d.received_at);
        else if (d.receivedAt) receivedAt = new Date(d.receivedAt);

        payments.push({
          trxId: d.trx_id || d.trxId || doc.id,
          amount: Number(d.amount || 0),
          provider: d.provider || (d.raw_sms?.toLowerCase().includes('bkash') ? 'bKash' : 'Nagad'),
          sender: d.sender || d.sender_number || d.senderNumber || '',
          rawSms: d.raw_sms || d.rawSms || '',
          used: Boolean(d.used),
          receivedAt: receivedAt,
          raw: d
        });
      });
      payments.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
      onUpdate(payments);
    }, err => {
      console.error('Error watching unmatched payments:', err);
      if (onError) onError(err);
    });
  }

  /**
   * Manual Match Payment to Target Order
   */
  async manualMatchPayment(trxId, orderId) {
    const db = this.getDb();
    if (!db) throw new Error('Firestore not initialized');

    let actualId = orderId.trim();
    let targetDoc = await db.collection('purchases').doc(actualId).get();
    if (!targetDoc.exists) {
      targetDoc = await db.collection('orders').doc(actualId).get();
    }
    if (!targetDoc.exists) {
      // Check if short code or prefix was supplied (e.g. PB-74JSIN or 74JSIN)
      const cleanCode = actualId.replace(/^PB-?/i, '').toLowerCase();
      const snap = await db.collection('orders').get();
      const match = snap.docs.find(d => d.id.toLowerCase().startsWith(cleanCode));
      if (match) {
        targetDoc = match;
        actualId = match.id;
      }
    }
    if (!targetDoc.exists) {
      throw new Error(`Order #${orderId} was not found in purchases or orders`);
    }

    const batch = db.batch();
    const nowIso = new Date().toISOString();

    const paymentRef = db.collection('payments').doc(trxId);
    batch.set(paymentRef, {
      used: true,
      status: 'matched',
      matched_order_id: actualId,
      matchedOrderId: actualId,
      matched_at: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const orderPayload = {
      status: 'paid',
      paymentStatus: 'paid',
      payment_status: 'paid',
      trxId: trxId,
      trx_id: trxId,
      confirmed_at: firebase.firestore.FieldValue.serverTimestamp(),
      confirmedAt: nowIso,
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      admin_note: `Payment matched manually via TrxID ${trxId}`
    };

    batch.set(db.collection('purchases').doc(actualId), orderPayload, { merge: true });
    batch.set(db.collection('orders').doc(actualId), orderPayload, { merge: true });

    await batch.commit();

    // Dual-sync to pettybloomform secondary DB
    try {
      const formDb = this.getFormDb ? this.getFormDb() : null;
      if (formDb) {
        await formDb.collection('orders').doc(actualId).set(orderPayload, { merge: true });
      }
    } catch (e) {
      console.warn('Dual-sync manual match to formDb error:', e);
    }

    return true;
  }

  /**
   * Dismiss or Delete Unmatched Payment
   */
  async dismissPayment(trxId) {
    const db = this.getDb();
    if (!db) throw new Error('Firestore not initialized');
    try {
      await db.collection('payments').doc(trxId).delete();
    } catch (_) {
      await db.collection('payments').doc(trxId).set({
        used: true,
        status: 'dismissed'
      }, { merge: true });
    }
    return true;
  }

  /**
   * Direct Upload Image to Cloudinary (using 'memory-remains' preset)
   */
  async uploadImageToCloudinary(file, folder = 'templates') {
    const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/cmpl84gp/image/upload';
    const CLOUDINARY_UPLOAD_PRESET = 'memory-remains';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', folder);

    const res = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudinary upload failed: ${errText}`);
    }

    const data = await res.json();
    return data.secure_url || data.url;
  }

  /**
   * Download all customer photos in an order as an organized ZIP archive
   */
  async downloadOrderPhotosZip(order, onProgress) {
    if (typeof JSZip === 'undefined' || typeof saveAs === 'undefined') {
      throw new Error('JSZip or FileSaver library is not loaded');
    }

    const allUrls = [];
    const pushUrl = (url, name) => {
      if (url && typeof url === 'string' && url.startsWith('http') && !allUrls.some(u => u.url === url && u.name === name)) {
        allUrls.push({ url, name });
      }
    };

    const zip = new JSZip();

    if (order.items && order.items.length > 0) {
      order.items.forEach((item, itemIdx) => {
        const cleanTmpl = (item.templateName || 'Item').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
        const cleanRecip = (item.recipientName || `Item_${itemIdx + 1}`).replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
        const folderName = `${itemIdx + 1}_${cleanTmpl}_${cleanRecip}`;

        if (item.coverPhotoUrl) pushUrl(item.coverPhotoUrl, `${folderName}/cover_page`);
        if (item.backPhotoUrl) pushUrl(item.backPhotoUrl, `${folderName}/back_page`);
        (item.innerPhotoUrls || []).forEach((u, i) => {
          const pad = String(i + 1).padStart(2, '0');
          pushUrl(u, `${folderName}/inner_pages/page_${pad}`);
        });
        (item.photoUrls || []).forEach((u, i) => {
          const pad = String(i + 1).padStart(2, '0');
          pushUrl(u, `${folderName}/photo_${pad}`);
        });
      });
    }

    if (order.coverPhotoUrl) pushUrl(order.coverPhotoUrl, 'cover_page');
    if (order.backPhotoUrl) pushUrl(order.backPhotoUrl, 'back_page');
    (order.innerPhotoUrls || []).forEach((u, i) => pushUrl(u, `inner_pages/page_${String(i + 1).padStart(2, '0')}`));
    (order.photoUrls || []).forEach((u, i) => pushUrl(u, `photos/photo_${String(i + 1).padStart(2, '0')}`));

    // Form order structured photos
    if (order.structuredPhotos) {
      const sp = order.structuredPhotos;
      (sp.polaroid || []).forEach((u, i) => {
        if (typeof u === 'string') pushUrl(u, `polaroids/polaroid_${String(i + 1).padStart(2, '0')}`);
      });
      (sp.frames || []).forEach((f, i) => {
        const u = typeof f === 'string' ? f : f?.url;
        if (u) pushUrl(u, `frames/frame_${f.size || 'custom'}_${String(i + 1).padStart(2, '0')}`);
      });
      (sp.miniMag || []).forEach(b => {
        const bNum = b.booklet || 1;
        (b.urls || b.files || []).forEach((u, i) => {
          if (typeof u === 'string') pushUrl(u, `mini_mag/booklet_${bNum}/photo_${String(i + 1).padStart(2, '0')}`);
        });
      });
    }

    if (allUrls.length === 0) {
      throw new Error('No photos found for this order.');
    }

    let loadedCount = 0;
    const fetchPromises = allUrls.map(async ({ url, name }) => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Fetch failed');
        const blob = await resp.blob();
        const ext = url.includes('.png') ? 'png' : (url.includes('.webp') ? 'webp' : 'jpg');
        zip.file(`${name}.${ext}`, blob);
        loadedCount++;
        if (onProgress) onProgress(loadedCount / allUrls.length);
      } catch (err) {
        console.warn(`Failed to fetch image ${url} for zip:`, err);
      }
    });

    await Promise.all(fetchPromises);
    const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      if (onProgress) onProgress(0.9 + (metadata.percent / 1000));
    });

    const safeOrderId = (order.orderId || 'order').replace(/[^\w-]/g, '_');
    saveAs(content, `order_${safeOrderId}_photos.zip`);
    return true;
  }

  /**
   * Initialize Global Real-time Counts listener across both databases
   */
  initRealtimeCounts() {
    const db = this.getDb();
    const formDb = this.getFormDb();
    if (!db && !formDb) return () => {};

    // Deduplicated map for all order statuses: docId -> normalized status
    const allOrderStatuses = new Map();

    const recomputeOrderCounts = () => {
      let pending = 0;
      let paid = 0;
      let flagged = 0;
      let completed = 0;
      let cancelled = 0;

      allOrderStatuses.forEach(rawStatus => {
        const status = (rawStatus || 'pending').toLowerCase();
        if (status === 'pending' || status === 'awaiting_trx') pending++;
        else if (status === 'paid' || status === 'confirmed' || status === 'preparing' || status === 'shipped' || status === 'delivered' || status === 'in_progress') paid++;
        else if (status === 'flagged') flagged++;
        else if (status === 'completed') completed++;
        else if (status === 'cancelled' || status === 'rejected') cancelled++;
      });

      adminState.setCounts({
        pendingCount: pending,
        paidCount: paid,
        flaggedCount: flagged,
        completedCount: completed,
        cancelledCount: cancelled
      });
    };

    const unsubs = [];

    // 1. Petty-Bloom purchases listener
    if (db) {
      try {
        const u1 = db.collection('purchases').onSnapshot(snapshot => {
          snapshot.forEach(doc => allOrderStatuses.set(doc.id, doc.data()?.status));
          recomputeOrderCounts();
        }, err => console.warn('Purchases count listener notice:', err.message));
        unsubs.push(u1);
      } catch (e) { console.warn(e); }

      // 2. Petty-Bloom orders listener
      try {
        const u2 = db.collection('orders').onSnapshot(snapshot => {
          snapshot.forEach(doc => allOrderStatuses.set(doc.id, doc.data()?.status));
          recomputeOrderCounts();
        }, err => console.warn('Orders count listener notice:', err.message));
        unsubs.push(u2);
      } catch (e) { console.warn(e); }
    }

    // 3. PettyBloomForm live orders listener
    if (formDb) {
      try {
        const u3 = formDb.collection('orders').onSnapshot(snapshot => {
          snapshot.forEach(doc => allOrderStatuses.set(doc.id, doc.data()?.status));
          recomputeOrderCounts();
        }, err => console.warn('FormDb orders count listener notice:', err.message));
        unsubs.push(u3);
      } catch (e) { console.warn(e); }
    }

    // 4. Guaranteed REST sync & polling for counts from pettybloomform
    const syncCountsFromRest = async () => {
      try {
        const restOrders = await this.fetchFormOrdersRest();
        if (restOrders && restOrders.length > 0) {
          restOrders.forEach(o => allOrderStatuses.set(o.orderId, o.status));
          recomputeOrderCounts();
        }
      } catch (e) {
        console.warn('REST count poll notice:', e);
      }
    };
    syncCountsFromRest();
    const countIntervalId = setInterval(syncCountsFromRest, 6000);
    unsubs.push(() => clearInterval(countIntervalId));

    // Unmatched payments count listener from 'payments' collection
    if (db) {
      try {
        const unsubPayments = db.collection('payments').where('used', '==', false).onSnapshot(snapshot => {
          adminState.setCounts({ unmatchedCount: snapshot.size });
        }, err => console.warn('Payments counts notice:', err.message));
        unsubs.push(unsubPayments);
      } catch (e) { console.warn(e); }

      // Templates count listener
      try {
        const unsubTemplates = db.collection('templates').onSnapshot(snapshot => {
          adminState.setCounts({ templatesCount: snapshot.size });
        }, () => {});
        unsubs.push(unsubTemplates);
      } catch (e) { console.warn(e); }

      // Categories count listener
      try {
        const unsubCategories = db.collection('categories').onSnapshot(snapshot => {
          adminState.setCounts({ categoriesCount: snapshot.size });
        }, () => {});
        unsubs.push(unsubCategories);
      } catch (e) { console.warn(e); }

      // Collections count listener
      try {
        const unsubCollections = db.collection('site_collections').onSnapshot(snapshot => {
          adminState.setCounts({ collectionsCount: snapshot.size });
        }, () => {});
        unsubs.push(unsubCollections);
      } catch (e) { console.warn(e); }

      // Web archives pending count listener
      try {
        const unsubWeb = db.collection('web_archives').onSnapshot(snapshot => {
          let unDownloaded = 0;
          snapshot.forEach(doc => {
            if (doc.data()?.isDownloaded !== true) unDownloaded++;
          });
          adminState.setCounts({ webUploadsCount: unDownloaded });
        }, () => {});
        unsubs.push(unsubWeb);
      } catch (e) { console.warn(e); }
    }

    return () => {
      unsubs.forEach(u => typeof u === 'function' && u());
    };
  }


  /**
   * Categories
   */
  watchCategories(onUpdate) {
    const db = this.getDb();
    if (!db) return () => {};
    return db.collection('categories').onSnapshot(snapshot => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      onUpdate(list);
    });
  }

  async saveCategory(id, data) {
    const db = this.getDb();
    const docRef = id ? db.collection('categories').doc(id) : db.collection('categories').doc();
    await docRef.set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return docRef.id;
  }

  async deleteCategory(id) {
    const db = this.getDb();
    await db.collection('categories').doc(id).delete();
  }

  /**
   * Collections
   */
  watchCollections(onUpdate) {
    const db = this.getDb();
    if (!db) return () => {};
    return db.collection('site_collections').onSnapshot(snapshot => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      onUpdate(list);
    });
  }

  async saveCollection(id, data) {
    const db = this.getDb();
    const docRef = id ? db.collection('site_collections').doc(id) : db.collection('site_collections').doc();
    await docRef.set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return docRef.id;
  }

  async deleteCollection(id) {
    const db = this.getDb();
    await db.collection('site_collections').doc(id).delete();
  }

  /**
   * Product Catalog Collections (templates, catalog_frames, catalog_posters, catalog_stickers)
   */
  watchCatalogCollection(collectionName, onUpdate) {
    const db = this.getDb();
    if (!db) return () => {};
    return db.collection(collectionName).onSnapshot(snapshot => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      onUpdate(list);
    });
  }

  async saveCatalogItem(collectionName, id, data) {
    const db = this.getDb();
    const docRef = id ? db.collection(collectionName).doc(id) : db.collection(collectionName).doc();
    await docRef.set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return docRef.id;
  }

  async deleteCatalogItem(collectionName, id) {
    const db = this.getDb();
    await db.collection(collectionName).doc(id).delete();
  }

  /**
   * Customer Web Uploads (web_archives)
   */
  watchWebArchives(onUpdate) {
    const db = this.getDb();
    if (!db) return () => {};
    return db.collection('web_archives').onSnapshot(snapshot => {
      const list = [];
      snapshot.forEach(doc => {
        const data = doc.data() || {};
        let createdAt = new Date();
        if (data.createdAt?.toDate) createdAt = data.createdAt.toDate();
        else if (data.createdAt) createdAt = new Date(data.createdAt);

        // Derive name from formattedName, filename, or customerName
        const rawFormatted = data.formattedName ? String(data.formattedName).trim() : '';
        const rawFilename = data.filename ? String(data.filename).trim() : '';
        let cleanedFilename = rawFilename ? rawFilename.replace(/\.zip$/i, '').trim() : '';
        
        let resolvedName = rawFormatted || cleanedFilename || data.customerName || data.customer_name || 'Web Upload';
        // Clean part indicators e.g. " (Part 1)"
        resolvedName = resolvedName.replace(/\s*\([^)]*Part[^)]*\)/i, '').trim();

        // Extract customer name and code if structured as "name - code"
        let displayName = resolvedName;
        let refCode = '';
        if (resolvedName.includes(' - ')) {
          const parts = resolvedName.split(' - ');
          displayName = parts[0].trim();
          refCode = parts.slice(1).join(' - ').trim();
        } else if (resolvedName.includes('-')) {
          const parts = resolvedName.split('-');
          displayName = parts[0].trim();
          refCode = parts.slice(1).join('-').trim();
        }

        list.push({
          id: doc.id,
          orderId: data.orderId || data.order_id || refCode || doc.id.substring(0, 8),
          rawOrderId: data.orderId || data.order_id || '',
          refCode: refCode,
          customerName: displayName,
          formattedName: rawFormatted || resolvedName,
          filename: rawFilename || (resolvedName ? `${resolvedName}.zip` : ''),
          customerPhone: data.customerPhone || data.customer_phone || '',
          customerEmail: data.customerEmail || data.customer_email || '',
          productType: data.productType || data.product_type || 'Custom Prints',
          itemDescription: data.itemDescription || data.notes || '',
          isDownloaded: Boolean(data.isDownloaded),
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : (Array.isArray(data.photoUrls) ? data.photoUrls : []),
          sizeBytes: (typeof data.sizeBytes === 'number') ? data.sizeBytes : 0,
          createdAt: createdAt,
          raw: data
        });
      });
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onUpdate(list);
    });
  }

  async updateWebArchiveDownloaded(id, isDownloaded) {
    const db = this.getDb();
    await db.collection('web_archives').doc(id).set({
      isDownloaded: Boolean(isDownloaded),
      downloadedAt: isDownloaded ? firebase.firestore.FieldValue.serverTimestamp() : null
    }, { merge: true });
  }

  async deleteWebArchive(id) {
    const db = this.getDb();
    if (!db) return;
    await db.collection('web_archives').doc(id).delete();
  }

  /**
   * Announcement Bar & Store Settings
   */
  async getStoreSettings() {
    const db = this.getDb();
    const doc = await db.collection('settings').doc('store').get();
    return doc.exists ? doc.data() : { announcement: '', announcementEnabled: false, announcementLink: '' };
  }

  async saveStoreSettings(data) {
    const db = this.getDb();
    await db.collection('settings').doc('store').set({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  /**
   * Trigger Order Timeout Check
   */
  async runTimeoutCheck() {
    const db = this.getDb();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const snap = await db.collection('purchases').where('status', '==', 'pending').get();
    let checked = 0;
    let timedOut = 0;

    const batch = db.batch();
    snap.forEach(doc => {
      checked++;
      const data = doc.data();
      let created = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
      if (created && created < twoHoursAgo) {
        timedOut++;
        batch.set(doc.ref, {
          status: 'cancelled',
          admin_note: 'Auto-cancelled: Payment timeout exceeded (2 hours)',
          updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    });

    if (timedOut > 0) {
      await batch.commit();
    }

    return { checked_count: checked, timeout_count: timedOut };
  }

  /**
   * Cleanup Stale Uploads older than 2 hours
   */
  async cleanupStaleUploads() {
    const db = this.getDb();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const snap = await db.collection('web_archives').where('isDownloaded', '==', true).get();
    let cleaned = 0;
    const batch = db.batch();

    snap.forEach(doc => {
      const data = doc.data();
      let created = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
      if (created && created < twoHoursAgo) {
        cleaned++;
        batch.delete(doc.ref);
      }
    });

    if (cleaned > 0) {
      await batch.commit();
    }
    return { cleaned_count: cleaned };
  }
}

export const adminApi = new AdminApiService();
