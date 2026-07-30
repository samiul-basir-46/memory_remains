/**
 * Smooth Physics Inertia Scrolling Engine
 * Delivers luxury momentum-based smooth scrolling (Lenis / Locomotive style physics)
 */

let targetY = 0;
let currentY = 0;
let isRunning = false;
let animationFrameId = null;
let isInitialized = false;

// Physics parameters
const DAMPING = 0.085; // Exponential lerp damping factor (0.085 = silky momentum)
const WHEEL_MULTIPLIER = 0.85; // Speed scaling

export function initSmoothScroll() {
  if (isInitialized) return;

  // Check if touch device - keep touch scrolling native
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    document.documentElement.style.scrollBehavior = 'smooth';
    return;
  }

  isInitialized = true;
  document.documentElement.style.scrollBehavior = 'auto';

  targetY = window.scrollY;
  currentY = window.scrollY;

  // Intercept wheel events for smooth physics inertia
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('scroll', onNativeScroll, { passive: true });
  window.addEventListener('keydown', onKeyDown);
  
  // Smooth scroll for anchor clicks (e.g., #section)
  document.addEventListener('click', onAnchorClick);
}

function getMaxScroll() {
  return Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  ) - window.innerHeight;
}

function onWheel(e) {
  // If scrolling inside an open modal/drawer/container with its own scrollbar, do not intercept
  if (isInsideScrollableContainer(e.target)) {
    return;
  }

  e.preventDefault();

  const maxScroll = getMaxScroll();
  const delta = e.deltaY * WHEEL_MULTIPLIER;

  // Smoothly accumulate target scroll position
  targetY = Math.min(Math.max(0, targetY + delta), maxScroll);

  if (!isRunning) {
    isRunning = true;
    animationFrameId = requestAnimationFrame(updateScroll);
  }
}

function onNativeScroll() {
  // Resync if position shifted externally (e.g. scrollbar thumb drag)
  if (Math.abs(window.scrollY - currentY) > 60 && !isRunning) {
    targetY = window.scrollY;
    currentY = window.scrollY;
  }
}

function updateScroll() {
  const diff = targetY - currentY;
  
  if (Math.abs(diff) < 0.3) {
    currentY = targetY;
    window.scrollTo(0, currentY);
    isRunning = false;
    animationFrameId = null;
    return;
  }

  currentY += diff * DAMPING;
  window.scrollTo(0, currentY);

  animationFrameId = requestAnimationFrame(updateScroll);
}

function onKeyDown(e) {
  if (isInsideScrollableContainer(e.target) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) {
    return;
  }

  const maxScroll = getMaxScroll();
  let step = 0;

  if (e.key === 'ArrowDown') step = 120;
  else if (e.key === 'ArrowUp') step = -120;
  else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) step = window.innerHeight * 0.8;
  else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) step = -window.innerHeight * 0.8;
  else if (e.key === 'Home') {
    e.preventDefault();
    targetY = 0;
    startAnimation();
    return;
  } else if (e.key === 'End') {
    e.preventDefault();
    targetY = maxScroll;
    startAnimation();
    return;
  }

  if (step !== 0) {
    e.preventDefault();
    targetY = Math.min(Math.max(0, targetY + step), maxScroll);
    startAnimation();
  }
}

function onAnchorClick(e) {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const targetId = link.getAttribute('href');
  if (!targetId || targetId === '#') return;

  const targetEl = document.querySelector(targetId);
  if (targetEl) {
    e.preventDefault();
    const rect = targetEl.getBoundingClientRect();
    const targetPos = window.scrollY + rect.top - 80;
    targetY = Math.min(Math.max(0, targetPos), getMaxScroll());
    startAnimation();
  }
}

function startAnimation() {
  if (!isRunning) {
    isRunning = true;
    animationFrameId = requestAnimationFrame(updateScroll);
  }
}

function isInsideScrollableContainer(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  let curr = el;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    const style = window.getComputedStyle(curr);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && curr.scrollHeight > curr.clientHeight) {
      return true;
    }
    curr = curr.parentElement;
  }
  return false;
}
