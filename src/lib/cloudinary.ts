import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  apiKey?: string;
}

// Default fallback configuration or stored in localStorage/Firestore
const DEFAULT_CONFIG: CloudinaryConfig = {
  cloudName: 'jaystarbliss',
  uploadPreset: 'jaystarbliss_cms',
  apiKey: ''
};

export const getCloudinaryConfig = async (): Promise<CloudinaryConfig> => {
  try {
    const docRef = doc(db, 'settings', 'cloudinary');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as CloudinaryConfig;
      if (data.cloudName) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Using local or default Cloudinary config', err);
  }

  const localName = localStorage.getItem('cloudinary_cloud_name');
  const localPreset = localStorage.getItem('cloudinary_upload_preset');
  const localApiKey = localStorage.getItem('cloudinary_api_key');

  if (localName) {
    return {
      cloudName: localName,
      uploadPreset: localPreset || 'unsigned_preset',
      apiKey: localApiKey || ''
    };
  }

  return DEFAULT_CONFIG;
};

/**
 * Upload an image file directly to Cloudinary using unsigned upload preset
 */
export const uploadImageToCloudinary = async (
  file: File,
  customPreset?: string,
  customCloudName?: string
): Promise<{ url: string; publicId: string; secureUrl: string }> => {
  const config = await getCloudinaryConfig();
  const cloudName = customCloudName || config.cloudName;
  const uploadPreset = customPreset || config.uploadPreset;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary Cloud Name or Upload Preset is not configured in Admin Settings.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'jaystarbliss_studios');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
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
 * Helper to generate an optimized Cloudinary delivery URL
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
