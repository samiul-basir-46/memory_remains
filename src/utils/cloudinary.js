const CLOUDINARY_HOST = 'res.cloudinary.com';
const IMAGE_CACHE_NAME = 'memory-remains-cloudinary-v1';

function isCloudinaryUrl(url = '') {
  return url.includes(CLOUDINARY_HOST);
}

export function buildCloudinaryDeliveryUrl(url, options = {}) {
  if (!url || !isCloudinaryUrl(url)) {
    return url;
  }

  const {
    width = 'auto',
    quality = 'auto:eco',
    format = 'auto',
    dpr = 'auto',
    crop = 'limit'
  } = options;

  const marker = '/upload/';
  if (!url.includes(marker)) {
    return url;
  }

  const transformation = `f_${format},q_${quality},dpr_${dpr},c_${crop},w_${width}`;
  return url.replace(marker, `${marker}${transformation}/`);
}

export async function compressImageFile(file, options = {}) {
  const {
    preserveOriginal = true,
    maxDimension = 4096,
    quality = 0.95
  } = options;

  // Preserve 100% Full HD original quality & size for print accuracy
  if (preserveOriginal) {
    return {
      file: file,
      originalBytes: file.size,
      optimizedBytes: file.size,
      ratioSaved: 0
    };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { alpha: false });
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const mimeType = file.type || 'image/jpeg';
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('Image processing failed.'));
      }, mimeType, quality);
    });

    const optimizedFile = new File([blob], file.name, { type: mimeType });
    return {
      file: optimizedFile,
      originalBytes: file.size,
      optimizedBytes: optimizedFile.size,
      ratioSaved: file.size ? 1 - optimizedFile.size / file.size : 0
    };
  } catch (_) {
    return { file: file, originalBytes: file.size, optimizedBytes: file.size, ratioSaved: 0 };
  }
}

export async function computeFileSignature(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function warmCloudinaryCache(url) {
  if (!('caches' in window) || !url || !isCloudinaryUrl(url)) {
    return;
  }

  const cache = await caches.open(IMAGE_CACHE_NAME);
  const existing = await cache.match(url);
  if (!existing) {
    await cache.add(url).catch(() => undefined);
  }
}

export function setupLazyCloudinaryImages(root = document) {
  const images = Array.from(root.querySelectorAll('img[data-cld-src]'));
  if (!images.length) {
    return;
  }

  const applyImage = (image) => {
    const size = image.dataset.cldWidth || Math.ceil((image.clientWidth || window.innerWidth) * (window.devicePixelRatio || 1));
    const sourceUrl = buildCloudinaryDeliveryUrl(image.dataset.cldSrc, { width: size });
    image.src = sourceUrl;
    image.loading = 'lazy';
    image.decoding = 'async';
    warmCloudinaryCache(sourceUrl);
    image.removeAttribute('data-cld-src');
  };

  if (!('IntersectionObserver' in window)) {
    images.forEach(applyImage);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        applyImage(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '200px 0px' });

  images.forEach((image) => observer.observe(image));
}
