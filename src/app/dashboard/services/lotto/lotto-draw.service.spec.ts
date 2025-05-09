import { TestBed } from '@angular/core/testing';

import { LottoDrawService } from './lotto-draw.service';

describe('LottoDrawService', () => {
  let service: LottoDrawService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LottoDrawService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
