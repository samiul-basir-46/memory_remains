import { createToast, qs } from '../utils/ui.js';

export function populateProfile(user) {
  if (!user) return;
  const nameInput = qs('#profile-name');
  const emailInput = qs('#profile-email');
  const phoneInput = qs('#profile-phone');

  if (nameInput) nameInput.value = user.displayName || '';
  if (emailInput) emailInput.value = user.email || '';
  if (phoneInput) phoneInput.value = user.phoneNumber || '';
}

export function initProfileForm(user) {
  const form = qs('#profile-form');
  if (!form || !user) return;

  populateProfile(user);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      displayName: qs('#profile-name')?.value.trim() || '',
      phoneNumber: qs('#profile-phone')?.value.trim() || ''
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (user.updateProfile) {
        await user.updateProfile({ displayName: payload.displayName });
      }
      createToast('Profile updated successfully.');
    } catch (error) {
      console.error('Profile update failed:', error);
      createToast('Failed to update profile.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
