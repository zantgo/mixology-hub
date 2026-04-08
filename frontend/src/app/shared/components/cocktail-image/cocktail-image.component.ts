import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  @Input() imageUrl?: string;
  @Input() altText: string = 'Cocktail image';
  @Input() width: string = '100%';
  @Input() height: string = 'auto';
  @Input() objectFit: 'cover' | 'contain' | 'fill' = 'cover';
  @Input() imageClass: string = '';
  
  private defaultImages = [
    'assets/images/cocktails/default/cocktail-1.svg',
    'assets/images/cocktails/default/cocktail-2.svg',
    'assets/images/cocktails/default/cocktail-3.svg',
    'assets/images/cocktails/default/cocktail-4.svg',
    'assets/images/cocktails/default/cocktail-5.svg'
  ];
  
  private currentImageUrl: string = '';
  private errorCount = 0;
  private maxRetries = 3;

  ngOnInit() {
    this.setImageUrl();
  }

  ngOnChanges() {
    this.setImageUrl();
  }

  private setImageUrl() {
    this.errorCount = 0;
    if (this.imageUrl) {
      this.currentImageUrl = this.imageUrl;
    } else {
      this.currentImageUrl = this.getRandomDefaultImage();
    }
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