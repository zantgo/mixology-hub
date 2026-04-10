import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageService } from '../../core/services/image.service';

@Component({
  selector: 'app-cocktail-image',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cocktail-image-container">
      <img
        [src]="displayImageUrl"
        [alt]="altText"
        [class]="imageClass"
        (error)="onImageError()"
        [style.width]="width"
        [style.height]="height"
        [style.object-fit]="objectFit"
      />
    </div>
  `,
  styles: [`
    .cocktail-image-container {
      display: inline-block;
      overflow: hidden;
    }
    
    img {
      display: block;
      transition: opacity 0.3s ease;
    }
    
    img.error {
      opacity: 0.8;
    }
  `]
})
export class CocktailImageComponent implements OnInit {
  @Input() imageUrl?: string; // Legacy field
  @Input() imageFull?: string; // New field for full-size image
  @Input() imageThumb?: string; // New field for thumbnail image
  @Input() cocktailName?: string; // For consistent default image selection
  @Input() altText: string = 'Cocktail image';
  @Input() width: string = '100%';
  @Input() height: string = 'auto';
  @Input() objectFit: 'cover' | 'contain' | 'fill' = 'cover';
  @Input() imageClass: string = '';
  
  private currentImageUrl: string = '';
  private errorCount = 0;
  private maxRetries = 3;

  constructor(private imageService: ImageService) {}

  ngOnInit() {
    this.setImageUrl();
  }

  ngOnChanges() {
    this.setImageUrl();
  }

  private setImageUrl() {
    this.errorCount = 0;
    this.currentImageUrl = this.imageService.getSafeCocktailImageUrl(
      this.imageUrl,
      this.imageFull,
      this.imageThumb,
      this.cocktailName
    );
  }

  get displayImageUrl(): string {
    return this.currentImageUrl;
  }

  onImageError() {
    this.errorCount++;
    
    if (this.errorCount <= this.maxRetries && this.imageUrl) {
      // Try adding cache busting parameter
      this.currentImageUrl = this.addCacheBuster(this.imageUrl);
    } else {
      // Fall back to default image
      this.currentImageUrl = this.getRandomDefaultImage();
    }
  }

  private getRandomDefaultImage(): string {
    const randomIndex = Math.floor(Math.random() * this.defaultImages.length);
    return this.defaultImages[randomIndex];
  }

  private addCacheBuster(url: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set('t', Date.now().toString());
      return urlObj.toString();
    } catch {
      // If URL parsing fails, just return the original
      return url;
    }
  }
}