import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EndingTopbarComponent } from './ending-topbar.component';

describe('SidebarComponent', () => {
  let component: EndingTopbarComponent;
  let fixture: ComponentFixture<EndingTopbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EndingTopbarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EndingTopbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
