/**
 * Central State Store for Petty Bloom Admin Portal
 */

export const ADMIN_TABS = [
  {
    id: 'pending',
    title: 'Pending Orders',
    shortTitle: 'Pending',
    icon: 'fa-solid fa-hourglass-half',
    countKey: 'pendingCount',
    color: '#D97706',
    bgColor: '#FEF3C7',
    textColor: '#92400E'
  },
  {
    id: 'paid',
    title: 'Paid Orders',
    shortTitle: 'Paid',
    icon: 'fa-solid fa-circle-check',
    countKey: 'paidCount',
    color: '#059669',
    bgColor: '#D1FAE5',
    textColor: '#065F46'
  },
  {
    id: 'flagged',
    title: 'Flagged Orders',
    shortTitle: 'Flagged',
    icon: 'fa-solid fa-flag',
    countKey: 'flaggedCount',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    textColor: '#991B1B'
  },
  {
    id: 'unmatched',
    title: 'Unmatched Payments',
    shortTitle: 'Unmatched',
    icon: 'fa-solid fa-link-slash',
    countKey: 'unmatchedCount',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
    textColor: '#5B21B6'
  },
  {
    id: 'completed',
    title: 'Completed Orders',
    shortTitle: 'Completed',
    icon: 'fa-solid fa-square-check',
    countKey: 'completedCount',
    color: '#2563EB',
    bgColor: '#DBEAFE',
    textColor: '#1E40AF'
  },
  {
    id: 'cancelled',
    title: 'Cancelled Orders',
    shortTitle: 'Cancelled',
    icon: 'fa-solid fa-ban',
    countKey: 'cancelledCount',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    textColor: '#991B1B'
  },
  {
    id: 'catalog',
    title: 'Product Catalog',
    shortTitle: 'Catalog',
    icon: 'fa-solid fa-store',
    countKey: 'templatesCount',
    color: '#0F766E',
    bgColor: '#CCFBF1',
    textColor: '#115E59'
  },
  {
    id: 'categories',
    title: 'Categories',
    shortTitle: 'Categories',
    icon: 'fa-solid fa-tags',
    countKey: 'categoriesCount',
    color: '#8B5CF6',
    bgColor: '#F3E8FF',
    textColor: '#6B21A8'
  },
  {
    id: 'collections',
    title: 'Collections',
    shortTitle: 'Collections',
    icon: 'fa-solid fa-layer-group',
    countKey: 'collectionsCount',
    color: '#0284C7',
    bgColor: '#E0F2FE',
    textColor: '#075985'
  },
  {
    id: 'web-uploads',
    title: 'Web Customer Uploads',
    shortTitle: 'Web Uploads',
    icon: 'fa-solid fa-cloud-arrow-up',
    countKey: 'webUploadsCount',
    color: '#E11D48',
    bgColor: '#FFF1F2',
    textColor: '#9F1239'
  },
  {
    id: 'steadfast',
    title: 'Steadfast Courier API',
    shortTitle: 'Steadfast',
    icon: 'fa-solid fa-truck-fast',
    countKey: null,
    color: '#0284C7',
    bgColor: '#E0F2FE',
    textColor: '#075985'
  }
];

class AdminStateStore {
  constructor() {
    this.state = {
      currentUser: null,
      authLoading: true,
      activeTabIndex: 0,
      mobileMenuOpen: false,
      counts: {
        pendingCount: 0,
        paidCount: 0,
        flaggedCount: 0,
        unmatchedCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        templatesCount: 0,
        categoriesCount: 0,
        collectionsCount: 0,
        webUploadsCount: 0
      },
      searchQuery: '',
      catalogSubTab: 'templates', // 'templates' | 'frames' | 'posters' | 'stickers'
      webUploadsFilter: 'all', // 'all' | 'pending' | 'downloaded'
      isTimeoutChecking: false,
      isCleaningUp: false
    };

    this.listeners = new Set();
    this.subscriptions = [];
  }

  getState() {
    return this.state;
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  setActiveTab(index) {
    if (index >= 0 && index < ADMIN_TABS.length) {
      this.setState({
        activeTabIndex: index,
        searchQuery: '',
        mobileMenuOpen: false
      });
    }
  }

  setCounts(counts) {
    this.setState({
      counts: { ...this.state.counts, ...counts }
    });
  }

  setCatalogSubTab(subTab) {
    this.setState({ catalogSubTab: subTab });
  }

  setWebUploadsFilter(filter) {
    this.setState({ webUploadsFilter: filter });
  }

  showToast(type, message, duration = 3500) {
    const container = document.getElementById('admin-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'admin-toast';

    let iconHtml = '';
    let borderStyle = '';
    if (type === 'success') {
      iconHtml = '<i class="fa-solid fa-circle-check text-emerald-500 text-lg"></i>';
      borderStyle = 'border-l-4 border-emerald-500';
    } else if (type === 'error') {
      iconHtml = '<i class="fa-solid fa-circle-xmark text-rose-500 text-lg"></i>';
      borderStyle = 'border-l-4 border-rose-500';
    } else if (type === 'warning') {
      iconHtml = '<i class="fa-solid fa-triangle-exclamation text-amber-500 text-lg"></i>';
      borderStyle = 'border-l-4 border-amber-500';
    } else {
      iconHtml = '<i class="fa-solid fa-circle-info text-teal-600 text-lg"></i>';
      borderStyle = 'border-l-4 border-teal-600';
    }

    toast.className += ` ${borderStyle}`;
    toast.innerHTML = `
      ${iconHtml}
      <span class="text-slate-800 text-xs sm:text-sm font-medium">${message}</span>
      <button class="ml-auto text-slate-400 hover:text-slate-600 transition-colors p-1" onclick="this.parentElement.remove()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }

  clearSubscriptions() {
    this.subscriptions.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this.subscriptions = [];
  }

  addSubscription(unsub) {
    if (typeof unsub === 'function') {
      this.subscriptions.push(unsub);
    }
  }
}

export const adminState = new AdminStateStore();
