import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private defaultCocktailImages = [
    'assets/images/cocktails/default/cocktail-1.svg',
    'assets/images/cocktails/default/cocktail-2.svg',
    'assets/images/cocktails/default/cocktail-3.svg',
    'assets/images/cocktails/default/cocktail-4.svg',
    'assets/images/cocktails/default/cocktail-5.svg'
  ];

  /**
   * Get a safe image URL with fallback to default images
   * Now supports both external URLs and local upload paths
   */
  getSafeCocktailImageUrl(imageFull?: string, imageThumb?: string, cocktailName?: string): string {
    if (imageThumb) {
      return imageThumb;
    }
    if (imageFull) {
      return imageFull;
    }

    return this.getDefaultCocktailImage(cocktailName);
  }

  /**
   * Get a default cocktail image based on cocktail name or random
   */
  getDefaultCocktailImage(cocktailName?: string): string {
    if (cocktailName) {
      // Use cocktail name to get consistent default image
      const index = this.hashString(cocktailName) % this.defaultCocktailImages.length;
      return this.defaultCocktailImages[index];
    }
    // Random default image
    const randomIndex = Math.floor(Math.random() * this.defaultCocktailImages.length);
    return this.defaultCocktailImages[randomIndex];
  }

  /**
   * Validate if a string is a valid URL
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Simple string hash function for consistent default image selection
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Preload an image to check if it's accessible
   */
  preloadImage(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isValidUrl(url)) {
        resolve(false);
        return;
      }

      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
      
      // Timeout after 5 seconds
      setTimeout(() => resolve(false), 5000);
    });
  }
}