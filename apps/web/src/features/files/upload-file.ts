type UploadFileOptions = {
  file: File;
  uploadUrl: string;
  signal: AbortSignal;
  onProgress: (progress: number) => void;
};

export function uploadFileToSignedUrl({
  file,
  uploadUrl,
  signal,
  onProgress,
}: UploadFileOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();

    body.append('cacheControl', '3600');
    body.append('', file);

    const abort = () => xhr.abort();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    });

    xhr.addEventListener('load', () => {
      signal.removeEventListener('abort', abort);

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error(`Storage upload failed with status ${xhr.status}.`));
    });

    xhr.addEventListener('error', () => {
      signal.removeEventListener('abort', abort);
      reject(new Error('The Storage upload could not be completed.'));
    });

    xhr.addEventListener('abort', () => {
      signal.removeEventListener('abort', abort);
      reject(new DOMException('Upload cancelled.', 'AbortError'));
    });

    signal.addEventListener('abort', abort, { once: true });

    if (signal.aborted) {
      abort();
      return;
    }

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.send(body);
  });
}
