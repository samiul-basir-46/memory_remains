#!/usr/bin/env node

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error('Missing Cloudinary credentials. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  process.exit(1);
}

const rawIds = process.argv.slice(2);
if (!rawIds.length) {
  console.error('Usage: node tools/cloudinary-cleanup.mjs public_id_1 public_id_2 ...');
  process.exit(1);
}

const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`;

const response = await fetch(endpoint, {
  method: 'DELETE',
  headers: {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    public_ids: rawIds,
    invalidate: true
  })
});

if (!response.ok) {
  console.error('Cloudinary cleanup failed:', await response.text());
  process.exit(1);
}

const result = await response.json();
console.log('Deleted assets:', result.deleted || {});
