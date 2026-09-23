import https from 'node:https';

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function getAllSourceOrders() {
  const allDocs = [];
  let pageToken = '';
  do {
    const url = 'https://firestore.googleapis.com/v1/projects/pettybloomform/databases/(default)/documents/orders?pageSize=300' + (pageToken ? '&pageToken=' + pageToken : '');
    const res = await request(url);
    if (res.data && res.data.documents) {
      allDocs.push(...res.data.documents);
    }
    pageToken = res.data ? res.data.nextPageToken || '' : '';
  } while (pageToken);
  return allDocs;
}

async function syncToPettyBloom() {
  console.log('Fetching orders from pettybloomform...');
  const docs = await getAllSourceOrders();
  console.log(`Found ${docs.length} orders in pettybloomform.`);

  let synced = 0;
  let errors = 0;

  for (const doc of docs) {
    const docId = doc.name.split('/').pop();
    const fields = doc.fields;

    // Post to petty-bloom database 'orders' collection
    const targetUrl = `https://firestore.googleapis.com/v1/projects/petty-bloom/databases/(default)/documents/orders/${encodeURIComponent(docId)}`;
    const res = await request(targetUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { fields });

    // Also mirror to 'purchases' collection in petty-bloom
    const purchasesUrl = `https://firestore.googleapis.com/v1/projects/petty-bloom/databases/(default)/documents/purchases/${encodeURIComponent(docId)}`;
    await request(purchasesUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { fields });

    if (res.status === 200 || res.status === 201) {
      synced++;
    } else {
      errors++;
      console.warn(`Failed to sync doc ${docId}:`, res.status, res.data);
    }
  }

  console.log(`\nSync finished! Synced: ${synced}, Errors: ${errors}`);
}

syncToPettyBloom().catch(console.error);
