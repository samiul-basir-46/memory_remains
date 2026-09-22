import { getFirebaseServices } from '../services/firebase-service.js';
import { adminState } from './admin-state.js';

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
   * Listen to orders by status in real-time
   */
  watchOrders(status, onUpdate, onError) {
    const db = this.getDb();
    if (!db) return () => {};

    // Standardize status matching
    const query = db.collection('purchases');

    const unsubscribe = query.onSnapshot(
      snapshot => {
        const orders = [];
        snapshot.forEach(doc => {
          const order = this.normalizeOrder(doc);
          if (status === 'all' || order.status === status.toLowerCase()) {
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
   * Update order status with dual write to purchases and orders
   */
  async updateOrderStatus(orderId, newStatus, adminNote = '', additionalData = {}) {
    const db = this.getDb();
    if (!db) throw new Error('Firestore not initialized');

    const updatePayload = {
      status: newStatus.toLowerCase(),
      admin_note: adminNote,
      adminNote: adminNote,
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      ...additionalData
    };

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
      let unmatched = 0;
      let completed = 0;
      let cancelled = 0;

      snapshot.forEach(doc => {
        const status = (doc.data()?.status || 'pending').toLowerCase();
        if (status === 'pending') pending++;
        else if (status === 'paid') paid++;
        else if (status === 'flagged') flagged++;
        else if (status === 'unmatched') unmatched++;
        else if (status === 'completed') completed++;
        else if (status === 'cancelled') cancelled++;
      });

      adminState.setCounts({
        pendingCount: pending,
        paidCount: paid,
        flaggedCount: flagged,
        unmatchedCount: unmatched,
        completedCount: completed,
        cancelledCount: cancelled
      });
    }, err => console.warn('Counts listener notice:', err.message));

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

        list.push({
          id: doc.id,
          orderId: data.orderId || data.order_id || doc.id,
          customerName: data.customerName || data.customer_name || 'Web Visitor',
          customerPhone: data.customerPhone || data.customer_phone || '',
          customerEmail: data.customerEmail || data.customer_email || '',
          productType: data.productType || data.product_type || 'Custom Prints',
          itemDescription: data.itemDescription || data.notes || '',
          isDownloaded: Boolean(data.isDownloaded),
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : (Array.isArray(data.photoUrls) ? data.photoUrls : []),
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
