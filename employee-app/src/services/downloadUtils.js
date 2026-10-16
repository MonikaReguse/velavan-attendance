/**
 * Utility to reliably download any file (Base64 data URL, Blob URL, or remote file URL).
 * Automatically cleans filename and detects file extension.
 */
export function downloadFile(url, fileName = 'document') {
  if (!url) return;

  // Sanitize fileName
  const safeBaseName = String(fileName)
    .trim()
    .replace(/[^a-zA-Z0-9_\-\.\s]/g, '')
    .replace(/\s+/g, '_');

  try {
    // 1. Data URLs (Base64)
    if (url.startsWith('data:')) {
      let ext = '';
      const mimeMatch = url.match(/^data:([a-zA-Z0-9\/\+\-\.]+);/);
      if (mimeMatch) {
        const mime = mimeMatch[1].toLowerCase();
        if (mime.includes('pdf')) ext = '.pdf';
        else if (mime.includes('png')) ext = '.png';
        else if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
        else if (mime.includes('webp')) ext = '.webp';
        else if (mime.includes('svg')) ext = '.svg';
      }
      const finalName = safeBaseName.includes('.') ? safeBaseName : `${safeBaseName}${ext || '.png'}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // 2. HTTP / HTTPS / Blob URLs
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.blob();
      })
      .then(blob => {
        let ext = '';
        if (blob.type) {
          if (blob.type.includes('pdf')) ext = '.pdf';
          else if (blob.type.includes('png')) ext = '.png';
          else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) ext = '.jpg';
          else if (blob.type.includes('webp')) ext = '.webp';
        }
        const finalName = safeBaseName.includes('.') ? safeBaseName : `${safeBaseName}${ext || '.png'}`;
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = finalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      })
      .catch(err => {
        console.warn('Blob fetch failed, falling back to direct anchor download:', err);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeBaseName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
  } catch (err) {
    console.error('Download error:', err);
    window.open(url, '_blank');
  }
}
