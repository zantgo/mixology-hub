import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { ImageService } from '../../../core/services/image.service';

@Component({
  selector: 'app-cocktail-image',
  standalone: true,
  template: `
    <div class="cocktail-image-container">
      <img
        [src]="displayImageUrl"
        [alt]="altText"
        [class]="imageClass"
        [class.error]="hasError"
        (error)="onImageError()"
        [style.width]="width"
        [style.height]="height"
        [style.object-fit]="objectFit"
        loading="lazy"
      />
    </div>
  `,
  styles: [
    `
      .cocktail-image-container {
        display: inline-block;
        overflow: hidden;
      }

      img {
        display: block;
        transition: opacity 0.3s ease;
      }

      img.error {
        opacity: 0.85;
        filter: grayscale(20%);
      }
    `,
  ],
})
export class CocktailImageComponent implements OnInit, OnChanges {
  @Input() imageFull?: string;
  @Input() imageThumb?: string;
  @Input() cocktailName?: string;
  @Input() altText: string = 'Cocktail image';
  @Input() width: string = '100%';
  @Input() height: string = 'auto';
  @Input() objectFit: 'cover' | 'contain' | 'fill' = 'cover';
  @Input() imageClass: string = '';

  private currentImageUrl: string = '';
  private errorCount = 0;
  private readonly maxRetries = 2;
  hasError = false;

  constructor(private imageService: ImageService) {}

  ngOnInit() {
    this.setImageUrl();
  }

  ngOnChanges() {
    this.setImageUrl();
  }

  private setImageUrl() {
    this.errorCount = 0;
    this.hasError = false;
    this.currentImageUrl = this.imageService.getSafeCocktailImageUrl(
      this.imageFull,
      this.imageThumb,
      this.cocktailName,
    );
  }

  get displayImageUrl(): string {
    return this.currentImageUrl;
  }

  onImageError() {
    this.hasError = true;
    if (this.errorCount >= this.maxRetries) {
      this.currentImageUrl = 'assets/images/cocktails/default/cocktail-1.svg';
      return;
    }
    this.errorCount++;
    this.currentImageUrl = this.imageService.getDefaultCocktailImage(this.cocktailName);
  }
}
