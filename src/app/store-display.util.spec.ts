import { dedupeStoresForDropdown, formatStoreDisplayName } from './services/store.service';

describe('store display formatting', () => {
  it('should include the branch in the label', () => {
    expect(formatStoreDisplayName({ storeName: 'Alpha Store', branchName: 'Makati' } as any)).toBe('Alpha Store - Makati');
  });

  it('should remove duplicate dropdown entries by display label', () => {
    const stores = [
      { id: '1', storeName: 'Alpha Store', branchName: 'Makati' },
      { id: '2', storeName: 'Alpha Store', branchName: 'Makati' },
      { id: '3', storeName: 'Alpha Store', branchName: 'Taguig' },
      { id: '4', storeName: 'Beta Store', branchName: '' }
    ] as any[];

    expect(dedupeStoresForDropdown(stores).map(store => store.id)).toEqual(['1', '3', '4']);
  });
});
