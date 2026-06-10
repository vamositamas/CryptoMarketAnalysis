import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataAccessApiClient } from './data-access-api-client';

describe('DataAccessApiClient', () => {
  let component: DataAccessApiClient;
  let fixture: ComponentFixture<DataAccessApiClient>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataAccessApiClient],
    }).compileComponents();

    fixture = TestBed.createComponent(DataAccessApiClient);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
