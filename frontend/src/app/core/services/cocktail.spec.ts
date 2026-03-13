import { TestBed } from '@angular/core/testing';

import { Cocktail } from './cocktail';

describe('Cocktail', () => {
  let service: Cocktail;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Cocktail);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
