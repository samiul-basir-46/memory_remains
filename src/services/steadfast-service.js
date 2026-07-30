/**
 * Steadfast Courier API Integration Service
 * 
 * Documentation: https://documenter.getpostman.com/view/26211192/2sAYJ1mhpk
 * Base URL: https://portal.packzy.com/api/v1 (or https://portal.steadfast.com.bd/api/v1)
 */

export const STEADFAST_CONFIG = {
  baseUrl: 'https://portal.packzy.com/api/v1',
  apiKey: 'p1wkcr3iy9h9ty0toynjha7cfucnohta',
  secretKey: 'auhi4flunq1bhp8ocvoyaxnm'
};

/**
 * Creates a single delivery consignment in Steadfast Courier
 * 
 * @param {Object} orderInfo
 * @param {string} orderInfo.invoice - Unique Invoice ID / Order ID
 * @param {string} orderInfo.recipient_name - Customer Name
 * @param {string} orderInfo.recipient_phone - Customer Phone Number (11 digits e.g. 017XXXXXXXX)
 * @param {string} orderInfo.recipient_address - Detailed Shipping Address
 * @param {number|string} orderInfo.cod_amount - Cash on delivery amount to collect
 * @param {string} [orderInfo.recipient_email] - Customer Email
 * @param {string} [orderInfo.alternative_phone] - Alternative Phone Number
 * @param {string} [orderInfo.item_description] - Description of items in parcel
 * @param {string} [orderInfo.note] - Delivery instructions for courier rider
 * 
 * @returns {Promise<{success: boolean, consignment?: Object, message?: string, error?: any}>}
 */
export async function createSteadfastOrder(orderInfo) {
  const payload = {
    invoice: String(orderInfo.invoice),
    recipient_name: orderInfo.recipient_name || orderInfo.customer_name || 'Customer',
    recipient_phone: orderInfo.recipient_phone || orderInfo.customer_phone || '',
    recipient_address: orderInfo.recipient_address || orderInfo.address || '',
    cod_amount: String(orderInfo.cod_amount ?? 0),
    recipient_email: orderInfo.recipient_email || orderInfo.customer_email || '',
    alternative_phone: orderInfo.alternative_phone || '',
    item_description: orderInfo.item_description || orderInfo.product_name || 'Memory Remains Customized Print',
    note: orderInfo.note || 'পার্সেল ডেলিভারির সময় রিসিভ করার অনুমতি দিন।'
  };

  try {
    const response = await fetch(`${STEADFAST_CONFIG.baseUrl}/create_order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': STEADFAST_CONFIG.apiKey,
        'secret-key': STEADFAST_CONFIG.secretKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok && data.status === 200 && data.consignment) {
      return {
        success: true,
        message: data.message,
        consignment: data.consignment, // { consignment_id, tracking_code, status, ... }
        tracking_code: data.consignment.tracking_code,
        consignment_id: data.consignment.consignment_id
      };
    } else {
      return {
        success: false,
        message: data.message || 'Failed to create Steadfast order',
        error: data
      };
    }
  } catch (err) {
    console.error('Steadfast API Error:', err);
    return {
      success: false,
      message: 'Network or API error while connecting to Steadfast Courier',
      error: err.message
    };
  }
}

/**
 * Check consignment status by Invoice ID
 * @param {string} invoice 
 */
export async function checkSteadfastStatusByInvoice(invoice) {
  try {
    const response = await fetch(`${STEADFAST_CONFIG.baseUrl}/status_by_invoice/${encodeURIComponent(invoice)}`, {
      method: 'GET',
      headers: {
        'api-key': STEADFAST_CONFIG.apiKey,
        'secret-key': STEADFAST_CONFIG.secretKey
      }
    });

    return await response.json();
  } catch (err) {
    console.error('Steadfast Status Check Error:', err);
    return { status: 500, delivery_status: 'unknown', error: err.message };
  }
}

/**
 * Check consignment status by Tracking Code
 * @param {string} trackingCode 
 */
export async function checkSteadfastStatusByTrackingCode(trackingCode) {
  try {
    const response = await fetch(`${STEADFAST_CONFIG.baseUrl}/status_by_trackingcode/${encodeURIComponent(trackingCode)}`, {
      method: 'GET',
      headers: {
        'api-key': STEADFAST_CONFIG.apiKey,
        'secret-key': STEADFAST_CONFIG.secretKey
      }
    });

    return await response.json();
  } catch (err) {
    console.error('Steadfast Tracking Error:', err);
    return { status: 500, delivery_status: 'unknown', error: err.message };
  }
}

/**
 * Get current Steadfast Merchant Account Balance
 */
export async function getSteadfastBalance() {
  try {
    const response = await fetch(`${STEADFAST_CONFIG.baseUrl}/get_balance`, {
      method: 'GET',
      headers: {
        'api-key': STEADFAST_CONFIG.apiKey,
        'secret-key': STEADFAST_CONFIG.secretKey
      }
    });

    return await response.json();
  } catch (err) {
    console.error('Steadfast Balance Error:', err);
    return { status: 500, current_balance: 0, error: err.message };
  }
}
