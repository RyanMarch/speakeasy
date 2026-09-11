/**
 * Speakeasy Authentication Modal Component
 * Passwordless OTP sign-in dialog and guest-to-cloud data migration.
 */

import { requestOtp, verifyOtp, migrateGuestData } from '../modules/auth.js';
import { showToast } from './toast.js';

let _authModal = null;
let _authStepEmail = null;
let _authStepOtp = null;
let _authFormEmail = null;
let _authFormOtp = null;
let _authEmailInput = null;
let _authOtpInput = null;
let _authEmailDisplay = null;
let _authEmailError = null;
let _authOtpError = null;
let _authBtnBackEmail = null;
let _authBtnClose = null;

let _pendingEmail = '';

/**
 * Initializes DOM elements and event bindings for the Auth Modal.
 */
export function setupAuthModalEventListeners() {
  _authModal = document.getElementById('auth-modal');
  if (!_authModal) return;

  _authStepEmail = document.getElementById('auth-step-email');
  _authStepOtp = document.getElementById('auth-step-otp');
  _authFormEmail = document.getElementById('auth-form-email');
  _authFormOtp = document.getElementById('auth-form-otp');
  _authEmailInput = document.getElementById('auth-email-input');
  _authOtpInput = document.getElementById('auth-otp-input');
  _authEmailDisplay = document.getElementById('auth-email-display');
  _authEmailError = document.getElementById('auth-email-error');
  _authOtpError = document.getElementById('auth-otp-error');
  _authBtnBackEmail = document.getElementById('btn-auth-back');
  _authBtnClose = document.getElementById('btn-close-auth-modal');

  // Close button click
  _authBtnClose?.addEventListener('click', () => {
    closeAuthModal();
  });

  // Light dismiss on backdrop click for <dialog>
  _authModal.addEventListener('click', (event) => {
    if (event.target !== _authModal) return;
    const rect = _authModal.getBoundingClientRect();
    const isInsideDialog = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );
    if (!isInsideDialog) {
      closeAuthModal();
    }
  });

  // ESC key handler is natively handled by dialog, but ensure state reset on close
  _authModal.addEventListener('close', () => {
    resetAuthModalState();
  });

  // Back to email step button
  _authBtnBackEmail?.addEventListener('click', () => {
    goToEmailStep();
  });

  // Step 1: Submit email for OTP
  _authFormEmail?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = _authEmailInput?.value.trim().toLowerCase();
    if (!email) return;

    setFormLoading(_authFormEmail, true);
    setErrorMessage(_authEmailError, '');

    try {
      await requestOtp(email);
      _pendingEmail = email;
      goToOtpStep(email);
      showToast('Verification code sent');
    } catch (err) {
      setErrorMessage(_authEmailError, err.message || 'Failed to send verification code.');
    } finally {
      setFormLoading(_authFormEmail, false);
    }
  });

  // Step 2: Submit OTP code
  _authFormOtp?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawVal = _authOtpInput?.value || '';
    const code = rawVal.replace(/\D/g, '').slice(0, 6);
    if (!code || code.length !== 6 || !_pendingEmail) {
      setErrorMessage(_authOtpError, 'Please enter a valid 6-digit verification code.');
      return;
    }

    setFormLoading(_authFormOtp, true);
    setErrorMessage(_authOtpError, '');

    try {
      await verifyOtp(_pendingEmail, code);

      // Automatically migrate guest data to the authenticated cloud account
      try {
        await migrateGuestData();
      } catch (syncErr) {
        console.warn('Post-auth guest data migration error:', syncErr);
      }

      showToast('Welcome back!');
      closeAuthModal();
    } catch (err) {
      setErrorMessage(_authOtpError, err.message || 'Invalid or expired code.');
    } finally {
      setFormLoading(_authFormOtp, false);
    }
  });
}

function setFormLoading(form, isLoading) {
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle('loading', isLoading);
  }
}

function setErrorMessage(element, message) {
  if (!element) return;
  element.textContent = message || '';
  element.style.display = message ? 'block' : 'none';
}

function goToEmailStep() {
  if (_authStepEmail) _authStepEmail.style.display = 'block';
  if (_authStepOtp) _authStepOtp.style.display = 'none';
  setErrorMessage(_authEmailError, '');
  setErrorMessage(_authOtpError, '');
  setTimeout(() => {
    _authEmailInput?.focus();
  }, 50);
}

function goToOtpStep(email) {
  if (_authStepEmail) _authStepEmail.style.display = 'none';
  if (_authStepOtp) _authStepOtp.style.display = 'block';
  if (_authEmailDisplay) _authEmailDisplay.textContent = email;
  if (_authOtpInput) _authOtpInput.value = '';
  setErrorMessage(_authOtpError, '');
  setTimeout(() => {
    _authOtpInput?.focus();
  }, 50);
}

function resetAuthModalState() {
  _pendingEmail = '';
  if (_authEmailInput) _authEmailInput.value = '';
  if (_authOtpInput) _authOtpInput.value = '';
  setErrorMessage(_authEmailError, '');
  setErrorMessage(_authOtpError, '');
  if (_authStepEmail) _authStepEmail.style.display = 'block';
  if (_authStepOtp) _authStepOtp.style.display = 'none';
}

/**
 * Opens the Authentication Modal.
 */
export function openAuthModal() {
  if (!_authModal) {
    _authModal = document.getElementById('auth-modal');
  }
  if (!_authModal) return;

  resetAuthModalState();
  if (typeof _authModal.showModal === 'function') {
    _authModal.showModal();
  }
  setTimeout(() => {
    _authEmailInput?.focus();
  }, 60);
}

/**
 * Closes the Authentication Modal.
 */
export function closeAuthModal() {
  if (_authModal && typeof _authModal.close === 'function') {
    _authModal.close();
  }
}
