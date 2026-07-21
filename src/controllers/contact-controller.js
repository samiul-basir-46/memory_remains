import { createToast, qs } from '../utils/ui.js';

export async function submitNewsletter(db, form) {
  if (!form) return;
  const input = form.querySelector('input[type="email"]');
  const email = input?.value.trim();
  if (!email) return;

  try {
    if (db) {
      await db.collection('newsletter_subscribers').add({
        email,
        timestamp: new Date()
      });
    }
    input.value = '';
    createToast('Thanks for subscribing.');
  } catch (error) {
    console.error('Newsletter subscription failed:', error);
    createToast('Subscription failed. Please try again.', 'error');
  }
}

export async function submitContactForm(db, form) {
  if (!form) return;
  const payload = {
    name: qs('#contact-name', form)?.value.trim(),
    email: qs('#contact-email', form)?.value.trim(),
    subject: qs('#contact-subject', form)?.value.trim(),
    message: qs('#contact-message', form)?.value.trim()
  };

  try {
    if (db) {
      await db.collection('contact_messages').add({
        ...payload,
        timestamp: new Date()
      });
    }
    form.reset();
    createToast('Message sent successfully.');
  } catch (error) {
    console.error('Contact form failed:', error);
    createToast('Message could not be sent.', 'error');
  }
}

export function initContactEvents(db) {
  const contactForm = qs('#contact-form');
  contactForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitContactForm(db, contactForm);
  });

  const newsletterForms = document.querySelectorAll('form[data-newsletter]');
  newsletterForms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitNewsletter(db, form);
    });
  });
}
