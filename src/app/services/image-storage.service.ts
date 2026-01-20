import { Injectable } from '@angular/core';
import { 
  Storage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll,
  getMetadata
} from '@angular/fire/storage';
import { AuthService } from './auth.service';

export interface ImageUploadResult {
  downloadURL: string;
  fullPath: string;
  size: number;
  contentType: string;
}

export interface StorageUsageInfo {
  storeId: string;
  logoSize: number;
  productsSize: number;
  totalSize: number;
  productCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImageStorageService {
  
  constructor(
    private storage: Storage,
    private authService: AuthService
  ) {}

  /**
   * Upload store logo
   * Path: {storeId}/logo.{extension}
   */
  async uploadStoreLogo(storeId: string, file: File): Promise<ImageUploadResult> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User must be authenticated to upload images');
    }

    // Validate file type
    if (!this.isValidImageFile(file)) {
      throw new Error('Invalid image file. Only PNG, JPG, JPEG, and WebP are allowed.');
    }

    // Get file extension
    const extension = this.getFileExtension(file.name);
    const fileName = `logo.${extension}`;
    const fullPath = `${storeId}/${fileName}`;

    // Create storage reference
    const storageRef = ref(this.storage, fullPath);

    try {
      // Upload file
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type,
        customMetadata: {
          uploadedBy: this.authService.currentUser()?.uid || 'unknown',
          uploadedAt: new Date().getTime().toString(),
          storeId: storeId,
          imageType: 'logo'
        }
      });

      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        downloadURL,
        fullPath,
        size: snapshot.metadata.size || 0,
        contentType: snapshot.metadata.contentType || file.type
      };
    } catch (error) {
      console.error('Error uploading store logo:', error);
      throw new Error(`Failed to upload store logo: ${error}`);
    }
  }

  /**
   * Upload product image
   * Path: {storeId}/products/{productId}.{extension}
   */
  async uploadProductImage(storeId: string, productId: string, file: File): Promise<ImageUploadResult> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User must be authenticated to upload images');
    }

    // Validate file type
    if (!this.isValidImageFile(file)) {
      throw new Error('Invalid image file. Only PNG, JPG, JPEG, and WebP are allowed.');
    }

    // Get file extension
    const extension = this.getFileExtension(file.name);
    const fileName = `${productId}.${extension}`;
    const fullPath = `${storeId}/products/${fileName}`;

    // Create storage reference
    const storageRef = ref(this.storage, fullPath);

    try {
      // Upload file
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type,
        customMetadata: {
          uploadedBy: this.authService.currentUser()?.uid || 'unknown',
          uploadedAt: new Date().getTime().toString(),
          storeId: storeId,
          productId: productId,
          imageType: 'product'
        }
      });

      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        downloadURL,
        fullPath,
        size: snapshot.metadata.size || 0,
        contentType: snapshot.metadata.contentType || file.type
      };
    } catch (error) {
      console.error('Error uploading product image:', error);
      throw new Error(`Failed to upload product image: ${error}`);
    }
  }

  /**
   * Delete store logo
   */
  async deleteStoreLogo(storeId: string, fileName: string): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User must be authenticated to delete images');
    }

    const fullPath = `${storeId}/${fileName}`;
    const storageRef = ref(this.storage, fullPath);

    try {
      await deleteObject(storageRef);
      console.log(`Store logo deleted: ${fullPath}`);
    } catch (error) {
      console.error('Error deleting store logo:', error);
      throw new Error(`Failed to delete store logo: ${error}`);
    }
  }

  /**
   * Delete product image
   */
  async deleteProductImage(storeId: string, productId: string, fileName: string): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User must be authenticated to delete images');
    }

    const fullPath = `${storeId}/products/${fileName}`;
    const storageRef = ref(this.storage, fullPath);

    try {
      await deleteObject(storageRef);
      console.log(`Product image deleted: ${fullPath}`);
    } catch (error) {
      console.error('Error deleting product image:', error);
      throw new Error(`Failed to delete product image: ${error}`);
    }
  }

  /**
   * Get storage usage information for a specific store
   */
  async getStoreStorageUsage(storeId: string): Promise<StorageUsageInfo> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User must be authenticated to check storage usage');
    }

    let logoSize = 0;
    let productsSize = 0;
    let productCount = 0;

    try {
      // Check logo size
      const logoRef = ref(this.storage, `${storeId}/`);
      const logoList = await listAll(logoRef);
      
      for (const item of logoList.items) {
        if (item.name.startsWith('logo.')) {
          const metadata = await getMetadata(item);
          logoSize += metadata.size || 0;
        }
      }

      // Check products folder size
      const productsRef = ref(this.storage, `${storeId}/products/`);
      const productsList = await listAll(productsRef);
      
      for (const item of productsList.items) {
        const metadata = await getMetadata(item);
        productsSize += metadata.size || 0;
        productCount++;
      }

      return {
        storeId,
        logoSize,
        productsSize,
        totalSize: logoSize + productsSize,
        productCount
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return {
        storeId,
        logoSize: 0,
        productsSize: 0,
        totalSize: 0,
        productCount: 0
      };
    }
  }

  /**
   * Get storage usage for all stores (for admin monitoring)
   */
  async getAllStoresStorageUsage(): Promise<StorageUsageInfo[]> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User must be authenticated to check storage usage');
    }

    try {
      const rootRef = ref(this.storage, '/');
      const list = await listAll(rootRef);
      const usagePromises: Promise<StorageUsageInfo>[] = [];

      // Get all store folders
      for (const prefix of list.prefixes) {
        const storeId = prefix.name;
        usagePromises.push(this.getStoreStorageUsage(storeId));
      }

      return await Promise.all(usagePromises);
    } catch (error) {
      console.error('Error getting all stores storage usage:', error);
      return [];
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Get all product images for a store
   */
  async getStoreProductImages(storeId: string): Promise<Array<{ name: string; url: string; size: number }>> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User must be authenticated to access images');
    }

    try {
      const productsRef = ref(this.storage, `${storeId}/products/`);
      const list = await listAll(productsRef);
      const images: Array<{ name: string; url: string; size: number }> = [];

      for (const item of list.items) {
        const url = await getDownloadURL(item);
        const metadata = await getMetadata(item);
        images.push({
          name: item.name,
          url,
          size: metadata.size || 0
        });
      }

      return images;
    } catch (error) {
      console.error('Error getting store product images:', error);
      return [];
    }
  }

  /**
   * Get store logo URL
   */
  async getStoreLogo(storeId: string): Promise<string | null> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User must be authenticated to access images');
    }

    try {
      const storeRef = ref(this.storage, `${storeId}/`);
      const list = await listAll(storeRef);
      
      // Look for logo file
      for (const item of list.items) {
        if (item.name.startsWith('logo.')) {
          return await getDownloadURL(item);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting store logo:', error);
      return null;
    }
  }

  /**
   * Get product image URL
   */
  async getProductImage(storeId: string, productId: string): Promise<string | null> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User must be authenticated to access images');
    }

    try {
      const productsRef = ref(this.storage, `${storeId}/products/`);
      const list = await listAll(productsRef);
      
      // Look for product image file
      for (const item of list.items) {
        if (item.name.startsWith(`${productId}.`)) {
          return await getDownloadURL(item);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting product image:', error);
      return null;
    }
  }

  /**
   * Validate if file is a valid image
   */
  private isValidImageFile(file: File): boolean {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    return validTypes.includes(file.type);
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || 'png';
  }

  /**
   * Compress image before upload (optional feature)
   */
  async compressImage(file: File, maxWidth: number = 800, quality: number = 0.8): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file); // Fallback to original
            }
          },
          file.type,
          quality
        );
      };

      img.src = URL.createObjectURL(file);
    });
  }
}