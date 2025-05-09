import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BasketballEndingComponent } from './ending.component';

describe('BasketballEndingComponent', () => {
  let component: BasketballEndingComponent;
  let fixture: ComponentFixture<BasketballEndingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BasketballEndingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BasketballEndingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
