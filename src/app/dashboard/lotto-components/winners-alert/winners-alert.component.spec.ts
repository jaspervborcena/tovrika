import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WinnersAlertComponent } from './winners-alert.component';

describe('WinnersAlertComponent', () => {
  let component: WinnersAlertComponent;
  let fixture: ComponentFixture<WinnersAlertComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WinnersAlertComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WinnersAlertComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
