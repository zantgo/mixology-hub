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
    this.currentImageUrl = this.imageService.getDefaultCocktailImage(this.cocktailName);
  }
}