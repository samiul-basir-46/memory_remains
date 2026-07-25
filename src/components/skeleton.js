import { escapeHtml } from '../utils/ui.js';

/**
 * Render a single Product Card Skeleton
 */
export function renderProductCardSkeleton() {
  return `
    <div class="skeleton-card flex flex-col h-full rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm p-3 space-y-3">
      <!-- Image Skeleton -->
      <div class="skeleton-box w-full aspect-square rounded-xl"></div>
      
      <!-- Content Skeleton -->
      <div class="space-y-2 flex-1 flex flex-col justify-between pt-1">
        <div>
          <div class="skeleton-box w-3/4 h-4 rounded mb-2"></div>
          <div class="skeleton-box w-1/2 h-3 rounded"></div>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-gray-100">
          <div class="skeleton-box w-20 h-5 rounded"></div>
          <div class="skeleton-box w-16 h-8 rounded-lg"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a grid of product card skeletons
 */
export function renderProductGridSkeleton(count = 8) {
  return Array.from({ length: count }, () => renderProductCardSkeleton()).join('');
}

/**
 * Render a Showcase Banner Skeleton (used on Home Page)
 */
export function renderShowcaseSkeleton() {
  return `
    <div class="showcase-card bg-white rounded-2xl overflow-hidden shadow-sm border border-pink-100 grid grid-cols-1 lg:grid-cols-12 max-w-5xl mx-auto my-2 max-h-[85vh] lg:max-h-[540px]">
      <div class="lg:col-span-6 h-[360px] sm:h-[440px] lg:h-[540px] p-4 bg-gray-50 flex items-center justify-center">
        <div class="skeleton-box w-full h-full rounded-xl"></div>
      </div>
      <div class="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-[#FDF0F4]/40">
        <div class="space-y-4">
          <div class="skeleton-box w-3/4 h-8 rounded-lg"></div>
          <div class="skeleton-box w-1/3 h-7 rounded-md"></div>
          <div class="skeleton-box w-full h-16 rounded-lg"></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="skeleton-box w-full h-12 rounded-xl"></div>
          <div class="skeleton-box w-full h-12 rounded-xl"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Product Details Page Skeleton
 */
export function renderProductDetailsSkeleton() {
  return `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 max-w-7xl mx-auto px-4 py-8">
      <!-- Image Gallery Skeleton -->
      <div class="lg:col-span-6 space-y-4">
        <div class="skeleton-box w-full aspect-square rounded-2xl"></div>
        <div class="flex gap-3 overflow-x-auto pb-2">
          <div class="skeleton-box w-20 h-20 rounded-xl flex-shrink-0"></div>
          <div class="skeleton-box w-20 h-20 rounded-xl flex-shrink-0"></div>
          <div class="skeleton-box w-20 h-20 rounded-xl flex-shrink-0"></div>
        </div>
      </div>
      
      <!-- Info Column Skeleton -->
      <div class="lg:col-span-6 space-y-6">
        <div class="skeleton-box w-1/4 h-4 rounded"></div>
        <div class="skeleton-box w-3/4 h-8 rounded-lg"></div>
        <div class="skeleton-box w-1/3 h-7 rounded-md"></div>
        <div class="skeleton-box w-full h-24 rounded-xl"></div>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <div class="skeleton-box w-full h-14 rounded-xl"></div>
          <div class="skeleton-box w-full h-14 rounded-xl"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Empty State UI
 */
export function renderEmptyState({
  title = 'No Products Found',
  message = 'We couldn\'t find any products matching your criteria.',
  actionText = 'Browse All Products',
  actionUrl = '/collections/paid-products'
} = {}) {
  return `
    <div class="col-span-full py-16 px-4 text-center flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-gray-200 my-4 shadow-sm fade-in-content">
      <div class="w-20 h-20 rounded-full bg-pink-50 text-primary flex items-center justify-center mb-4 text-3xl shadow-inner">
        <i class="fa-solid fa-box-open"></i>
      </div>
      <h3 class="font-heading text-2xl font-bold text-[#2A2A2A] mb-2">${escapeHtml(title)}</h3>
      <p class="text-gray-500 text-sm max-w-md mb-6 leading-relaxed">${escapeHtml(message)}</p>
      ${actionText ? `
        <a href="${actionUrl}" class="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:bg-primary-strong transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 no-underline">
          ${escapeHtml(actionText)}
        </a>
      ` : ''}
    </div>
  `;
}

/**
 * Render Error State UI
 */
export function renderErrorState({
  title = 'Unable to Load Products',
  message = 'Something went wrong while connecting to Firebase. Please check your connection and try again.',
  retryAction = 'window.location.reload()'
} = {}) {
  return `
    <div class="col-span-full py-16 px-4 text-center flex flex-col items-center justify-center bg-white rounded-2xl border border-red-100 my-4 shadow-sm fade-in-content">
      <div class="w-20 h-20 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4 text-3xl shadow-inner">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h3 class="font-heading text-2xl font-bold text-[#2A2A2A] mb-2">${escapeHtml(title)}</h3>
      <p class="text-gray-500 text-sm max-w-md mb-6 leading-relaxed">${escapeHtml(message)}</p>
      <button type="button" onclick="${retryAction}" class="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:bg-primary-strong transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 cursor-pointer">
        <i class="fa-solid fa-rotate-right mr-2"></i> Try Again
      </button>
    </div>
  `;
}
