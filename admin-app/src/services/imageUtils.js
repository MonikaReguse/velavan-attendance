/**
 * Resolves any image URL (Base64 data URLs, full HTTP URLs, or server-stored uploads)
 * Ensures that if a URL is broken or missing, a high-quality SVG initials avatar is returned.
 */
export function resolvePhotoUrl(url, name = 'Staff') {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Staff')}&background=0D9488&color=fff&size=160&bold=true`;
  }
  const cleanUrl = url.trim();
  if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return cleanUrl;
  }
  const rawApi = import.meta.env.VITE_API_BASE_URL || 'https://velavan-attendance.onrender.com/api';
  const backendHost = rawApi.replace(/\/api\/?$/, '');

  if (cleanUrl.startsWith('/uploads/')) {
    return `${backendHost}${cleanUrl}`;
  }
  if (cleanUrl.startsWith('uploads/')) {
    return `${backendHost}/${cleanUrl}`;
  }
  return cleanUrl;
}

/**
 * Fallback error handler on <img onError={...}>
 * Prevents broken image [?] icon in browser by immediately switching to UI Avatars
 */
export function handleImageError(e, name = 'Staff') {
  if (!e || !e.currentTarget) return;
  e.currentTarget.onerror = null;
  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Staff')}&background=0D9488&color=fff&size=160&bold=true`;
}
