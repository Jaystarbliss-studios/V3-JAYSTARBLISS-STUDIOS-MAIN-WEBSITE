import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

const DEFAULT_CONFIG: CloudinaryConfig = {
  cloudName: 'jaystarbliss',
  uploadPreset: 'jaystarbliss_cms'
};

/**
 * Return only the Cloudinary values that are safe for a browser client.
 * Uploads use an unsigned preset, so API keys/secrets are never needed here.
 *
 * The publicSettings collection is intentionally public-readable and is the
 * only Firestore location consulted by the client for Cloudinary configuration.
 */
export const getCloudinaryConfig = async (): Promise<CloudinaryConfig> => {
  const envCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const envUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();

  if (envCloudName && envUploadPreset) {
    return {
      cloudName: envCloudName,
      uploadPreset: envUploadPreset
    };
  }

  try {
    const configRef = doc(db, 'publicSettings', 'cloudinary');
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const data = snap.data();
      const cloudName = typeof data.cloudName === 'string' ? data.cloudName.trim() : '';
      const uploadPreset = typeof data.uploadPreset === 'string' ? data.uploadPreset.trim() : '';

      if (cloudName && uploadPreset) {
        return { cloudName, uploadPreset };
      }
    }
  } catch (err) {
    console.warn('Using fallback Cloudinary configuration', err);
  }

  return DEFAULT_CONFIG;
};

/**
 * Upload an image file directly to Cloudinary using an unsigned upload preset.
 */
export const uploadImageToCloudinary = async (
  file: File,
  customPreset?: string,
  customCloudName?: string
): Promise<{ url: string; publicId: string; secureUrl: string }> => {
  const config = await getCloudinaryConfig();
  const cloudName = customCloudName?.trim() || config.cloudName;
  const uploadPreset = customPreset?.trim() || config.uploadPreset;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary Cloud Name or Upload Preset is not configured.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'jaystarbliss_studios');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    {
      method: 'POST',
      body: formData
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Cloudinary upload failed with status ${response.status}`);
  }

  const data = await response.json();
  return {
    url: data.url,
    secureUrl: data.secure_url,
    publicId: data.public_id
  };
};

/**
 * Helper to generate an optimized Cloudinary delivery URL.
 */
export const getOptimizedCloudinaryUrl = (
  url: string,
  options?: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'thumb';
    quality?: 'auto' | number;
    format?: 'auto' | 'webp' | 'png' | 'jpg';
  }
): string => {
  if (!url || !url.includes('cloudinary.com')) {
    return url;
  }

  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;

  const transforms: string[] = ['f_auto', 'q_auto'];
  if (options?.width) transforms.push(`w_${options.width}`);
  if (options?.height) transforms.push(`h_${options.height}`);
  if (options?.crop) transforms.push(`c_${options.crop}`);

  return `${parts[0]}/upload/${transforms.join(',')}/${parts[1]}`;
};
