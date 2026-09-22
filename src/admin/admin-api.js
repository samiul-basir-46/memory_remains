import { getFirebaseServices } from '../services/firebase-service.js';
import { adminState } from './admin-state.js';
import { createSteadfastOrder } from '../services/steadfast-service.js';

export class AdminApiService {
  constructor() {
    const { db, auth } = getFirebaseServices();
    this.db = db;
    this.auth = auth;
  }

  getDb() {
    if (!this.db) {
      const { db } = getFirebaseServices();
      this.db = db;
    }
    return this.db;
  }

  /**
   * Helper to normalize Firestore order doc
   */
  normalizeOrder(doc) {
    const data = doc.data() || {};
    const id = doc.id;

    // Dates
    let createdAt = new Date();
    if (data.createdAt?.toDate) createdAt = data.createdAt.toDate();
    else if (data.created_at?.toDate) createdAt = data.created_at.toDate();
    else if (data.createdAt) createdAt = new Date(data.createdAt);
    else if (data.created_at) createdAt = new Date(data.created_at);

    // Photos
    let photoUrls = [];
    if (Array.isArray(data.imageUrls)) photoUrls = data.imageUrls;
    else if (Array.isArray(data.photo_urls)) photoUrls = data.photo_urls;
    else if (Array.isArray(data.photoUrls)) photoUrls = data.photoUrls;

    // Items
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items = rawItems.map(item => ({
      itemId: item.item_id || item.itemId || '',
      templateId: item.template_id || item.templateId || '',
      templateName: item.template_name || item.templateName || item.title || 'Item',
      productType: item.product_type || item.productType || data.productType || 'magazine',
      recipientName: item.recipient_name || item.recipientName || '',
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

    return {
      orderId: id,
      customerName: data.customerName || data.customer_name || data.recipient_name || 'Anonymous',
      customerPhone: data.customerPhone || data.customer_phone || data.recipient_phone || '',
      customerEmail: data.customerEmail || data.customer_email || '',
      shippingAddress: data.shippingAddress || data.recipient_address || data.deliveryAddress || data.address || '',
      deliveryNote: data.deliveryNote || data.note || '',
      productAmount: Number(data.productAmount ?? data.subtotal ?? 0),
      deliveryCharge: Number(data.deliveryCharge ?? data.delivery_charge ?? data.shippingFee ?? 0),
      expectedAmount: Number(data.expectedAmount ?? data.totalAmount ?? data.total ?? 0),
      receivedAmount: data.receivedAmount ? Number(data.receivedAmount) : null,
      paymentMethod: data.paymentMethod || data.payment_method || 'bKash',
      trxId: data.trxId || data.trx_id || data.transactionId || '',
      status: (data.status || 'pending').toLowerCase(),
      flagReason: data.flagReason || data.flag_reason || '',
      adminNote: data.adminNote || data.admin_note || '',
      productType: data.productType || data.type || (items[0]?.productType) || 'magazine',
      templateName: data.templateName || data.template_title || (items[0]?.templateName) || '',
      photosUploaded: Boolean(data.photosUploaded || photoUrls.length > 0),
      photoUrls: photoUrls,
      items: items,
      courierName: data.courierName || data.courier_name || '',
      trackingNumber: data.trackingNumber || data.tracking_code || data.consignment_id || '',
      steadfastConsignment: data.steadfast_consignment || null,
      canvaLink: data.canvaLink || data.canva_link || (items[0]?.canvaLink) || '',
      createdAt: createdAt,
      raw: data
    };
  }

  /**
   * Status groupings matching Flutter Admin dashboard
   */
  static STATUS_GROUPS = {
    pending: ['pending', 'awaiting_trx'],
    paid: ['paid', 'confirmed', 'preparing', 'shipped', 'delivered'],
    completed: ['completed', 'delivered'],
    cancelled: ['cancelled', 'rejected'],
    flagged: ['flagged']
  };

  /**
   * Listen to orders by status in real-time
   */
  watchOrders(status, onUpdate, onError) {
    const db = this.getDb();
    if (!db) return () => {};

    const query = db.collection('purchases');
    const targetGroup = AdminApiService.STATUS_GROUPS[status.toLowerCase()];

    const unsubscribe = query.onSnapshot(
      snapshot => {
        const orders = [];
        snapshot.forEach(doc => {
          const order = this.normalizeOrder(doc);
          const orderStatus = (order.status || 'pending').toLowerCase();
          
          if (status === 'all') {
            orders.push(order);
          } else if (targetGroup) {
            if (targetGroup.includes(orderStatus)) {
              orders.push(order);
            }
          } else if (orderStatus === status.toLowerCase()) {
            orders.push(order);
          }
        });

        // Sort descending by createdAt
        orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        onUpdate(orders);
      },
      err => {
        console.error(`Error watching orders [${status}]:`, err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
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
    return true;
  }

  /**
   * Delete order completely (with confirmation)
   */
  async deleteOrder(orderId) {
    const db = this.getDb();
    if (!db) throw new Error('Firestore not initialized');

    const batch = db.batch();
    batch.delete(db.collection('purchases').doc(orderId));
    batch.delete(db.collection('orders').doc(orderId));
    await batch.commit();
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

    const orderDoc = await db.collection('purchases').doc(orderId).get();
    if (!orderDoc.exists) {
      throw new Error(`Order #${orderId} was not found in purchases`);
    }

    const batch = db.batch();
    const nowIso = new Date().toISOString();

    const paymentRef = db.collection('payments').doc(trxId);
    batch.set(paymentRef, {
      used: true,
      status: 'matched',
      matched_order_id: orderId,
      matchedOrderId: orderId,
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

    batch.set(db.collection('purchases').doc(orderId), orderPayload, { merge: true });
    batch.set(db.collection('orders').doc(orderId), orderPayload, { merge: true });

    await batch.commit();
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
   * Initialize Global Real-time Counts listener
   */
  initRealtimeCounts() {
    const db = this.getDb();
    if (!db) return () => {};

    // Purchases count listener
    const unsubPurchases = db.collection('purchases').onSnapshot(snapshot => {
      let pending = 0;
      let paid = 0;
      let flagged = 0;
      let completed = 0;
      let cancelled = 0;

      snapshot.forEach(doc => {
        const status = (doc.data()?.status || 'pending').toLowerCase();
        if (status === 'pending' || status === 'awaiting_trx') pending++;
        else if (status === 'paid' || status === 'confirmed' || status === 'preparing' || status === 'shipped' || status === 'delivered') paid++;
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
    }, err => console.warn('Purchases counts listener notice:', err.message));

    // Unmatched payments count listener from 'payments' collection
    const unsubPayments = db.collection('payments').where('used', '==', false).onSnapshot(snapshot => {
      adminState.setCounts({ unmatchedCount: snapshot.size });
    }, err => console.warn('Payments counts notice:', err.message));

    // Templates count listener
    const unsubTemplates = db.collection('templates').onSnapshot(snapshot => {
      adminState.setCounts({ templatesCount: snapshot.size });
    }, () => {});

    // Categories count listener
    const unsubCategories = db.collection('categories').onSnapshot(snapshot => {
      adminState.setCounts({ categoriesCount: snapshot.size });
    }, () => {});

    // Collections count listener
    const unsubCollections = db.collection('site_collections').onSnapshot(snapshot => {
      adminState.setCounts({ collectionsCount: snapshot.size });
    }, () => {});

    // Web archives pending count listener
    const unsubWeb = db.collection('web_archives').onSnapshot(snapshot => {
      let unDownloaded = 0;
      snapshot.forEach(doc => {
        if (doc.data()?.isDownloaded !== true) unDownloaded++;
      });
      adminState.setCounts({ webUploadsCount: unDownloaded });
    }, () => {});

    return () => {
      unsubPurchases();
      unsubPayments();
      unsubTemplates();
      unsubCategories();
      unsubCollections();
      unsubWeb();
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
