import { TestBed } from '@angular/core/testing';
import { BigQueryService } from './bigquery.service';

describe('BigQueryService', () => {
  let service: BigQueryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BigQueryService]
    });
    service = TestBed.inject(BigQueryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose sales dashboard revenue lookup', () => {
    expect(typeof service.getSalesDashboardRevenue).toBe('function');
  });
});
