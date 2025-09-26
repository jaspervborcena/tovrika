import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Product, InventoryBatch } from '../../models/product.model';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, app } from '../../firebase.config';
import { getStorage } from 'firebase/storage';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
  standalone: true,
  selector: 'app-product-manager',
  imports: [CommonModule, ReactiveFormsModule, ConfirmationDialogComponent],
  template: `
  <div class="modal-backdrop">
    <div class="modal" (click)="$event.stopPropagation()">
      <header class="modal-header">
        <h3>{{ isEditMode ? 'Edit Product' : 'New Product' }}</h3>
        <button type="button" aria-label="Close" class="close" (click)="close()">×</button>
      </header>

      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="grid">
          <label>Product Name
            <input formControlName="productName" />
          </label>

          <label>SKU
            <input formControlName="skuId" />
          </label>

          <label>Category
            <input formControlName="category" />
          </label>

          <label>Image
            <div class="image-field">
              <img *ngIf="imagePreviewUrl" [src]="imagePreviewUrl" alt="preview" />
              <button type="button" (click)="onImageButtonClick()" class="camera-btn">
                <span *ngIf="!imagePreviewUrl">Upload Image</span>
                <span *ngIf="imagePreviewUrl">Replace Image</span>
              </button>
              <input #fileInput type="file" accept="image/*" (change)="onFileChange($event)" hidden />
            </div>
          </label>

          <label>Is Multiple Inventory
            <input type="checkbox" formControlName="isMultipleInventory" />
          </label>

          <label>Total Stock
            <input type="number" formControlName="totalStock" />
          </label>

          <label>Selling Prices
            <input type="number" step="0.01" formControlName="sellingPrice" />
          </label>
        </div>

        <div *ngIf="isMultipleInventorySignal()" class="inventory-section">
          <h4>Inventory</h4>
          <div formArrayName="inventory">
            <div *ngFor="let batch of inventoryControls.controls; let i = index" [formGroupName]="i" class="batch">
              <div class="batch-header">
                <strong>Batch {{i + 1}} — {{batch.get('batchId')?.value}}</strong>
                <button type="button" title="Add Batch" (click)="addBatch()">＋</button>
              </div>

              <label>Batch ID
                <input formControlName="batchId" />
              </label>

              <label>Quantity
                <input type="number" formControlName="quantity" />
              </label>

              <label>Unit Price
                <input type="number" step="0.01" formControlName="unitPrice" />
              </label>

              <label>Received At
                <input type="datetime-local" formControlName="receivedAt" />
              </label>

              <label>Active
                <input type="checkbox" [disabled]="($any(batch.get('quantity')?.value) ?? 0) <= 0" [checked]="($any(batch.get('status')?.value) ?? '') === 'active'" (change)="setActive(i, $any($event.target).checked)" />
              </label>
            </div>
          </div>
        </div>

        <footer class="modal-footer">
          <button type="submit" [disabled]="form.invalid || isSaving">Save</button>
        </footer>
      </form>
    </div>

    <!-- Confirmation Dialog -->
    <app-confirmation-dialog
      *ngIf="showConfirmDialog()"
      [dialogData]="confirmDialogData()"
      (confirmed)="onConfirmDialog()"
      (cancelled)="onCancelDialog()"
    />
  </div>
  `,
  styles: [
    `
    .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; }
    .modal { background:white; padding:1rem; width:820px; max-width:95%; border-radius:8px; }
    .modal-header { display:flex; justify-content:space-between; align-items:center; }
    .close { background:none; border:none; font-size:1.4rem; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; }
    .inventory-section { margin-top:1rem; }
    .batch { border:1px solid #eee; padding:0.5rem; margin-bottom:0.5rem; }
    .image-field img { max-width:120px; max-height:120px; display:block; margin-bottom:0.25rem; }
    `,
  ],
})
export class ProductManagerComponent {
  form: FormGroup;
  isEditMode = false;
  isSaving = false;
  imageFile: File | null = null;
  imagePreviewUrl: string | null = null;

  // Confirmation dialog properties
  showConfirmDialog = signal(false);
  confirmDialogData = signal<ConfirmationDialogData>({
    title: '',
    message: '',
    confirmText: 'OK',
    cancelText: '',
    type: 'info'
  });

  private storage = getStorage(app);

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      productName: ['', Validators.required],
      skuId: [''],
      category: [''],
      isMultipleInventory: [false],
      totalStock: [0, [Validators.min(0)]],
      sellingPrice: [0],
      imageUrl: [''],
      inventory: this.fb.array([]),
    });

    // initialize default single batch when not multiple inventory
    this.form.get('isMultipleInventory')?.valueChanges.subscribe((v) => {
      if (!v) {
        // clear inventory and allow editing of totalStock and sellingPrice
        this.inventoryControls.clear();
      } else {
        if (this.inventoryControls.length === 0) {
          this.addInitialBatch();
        }
      }
      // update read-only/UI state and computed totals
      this.updateComputedTotals();
    });

    // when inventory changes, update computed totals (totalStock, sellingPrice)
    this.inventoryControls.valueChanges.subscribe(() => this.updateComputedTotals());

  // ensure initial computed state
  this.updateComputedTotals();
  }

  // signals
  isMultipleInventorySignal = signal(() => !!this.form.get('isMultipleInventory')?.value);

  get inventoryControls() {
    return this.form.get('inventory') as FormArray;
  }

  // Confirmation dialog methods
  showConfirmationDialog(data: ConfirmationDialogData): void {
    this.confirmDialogData.set(data);
    this.showConfirmDialog.set(true);
  }

  onConfirmDialog(): void {
    this.showConfirmDialog.set(false);
  }

  onCancelDialog(): void {
    this.showConfirmDialog.set(false);
  }

  addInitialBatch() {
    const initial: InventoryBatch = {
      batchId: '250826-09',
      quantity: 60,
      unitPrice: 1.75,
      receivedAt: '2025-08-26T18:00:00Z',
      status: 'active',
    };
    this.inventoryControls.push(this.batchGroupFrom(initial));
  }

  addBatch() {
    // add new batch at the top (move previous down)
    const newBatch: InventoryBatch = {
      batchId: Date.now().toString(),
      quantity: 0,
      unitPrice: 0,
      receivedAt: new Date().toISOString(),
      status: 'inactive',
    };
    // insert at 0
    this.inventoryControls.insert(0, this.batchGroupFrom(newBatch));
  }

  batchGroupFrom(b: InventoryBatch) {
    return this.fb.group({
      batchId: [b.batchId, Validators.required],
      quantity: [b.quantity, [Validators.required, Validators.min(0)]],
      unitPrice: [b.unitPrice, [Validators.required, Validators.min(0)]],
      receivedAt: [this.toInputLocal(b.receivedAt)],
      status: [b.status],
    });
  }

  toInputLocal(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  setActive(index: number, active: boolean) {
    if (!active) {
      this.inventoryControls.at(index).get('status')?.setValue('inactive');
      return;
    }

    // ensure only one active
    for (let i = 0; i < this.inventoryControls.length; i++) {
      this.inventoryControls.at(i).get('status')?.setValue(i === index ? 'active' : 'inactive');
    }
  }

  get totalStock() {
    // calculate from active batches
    return this.inventoryControls.controls.reduce((sum, g) => {
      const status = g.get('status')?.value;
      const qty = Number(g.get('quantity')?.value || 0);
      return sum + (status === 'active' ? qty : 0);
    }, 0);
  }

  get activeUnitPrice(): number {
    const active = this.inventoryControls.controls.find((g) => g.get('status')?.value === 'active');
    return active ? Number(active.get('unitPrice')?.value || 0) : Number(this.form.get('sellingPrice')?.value || 0);
  }

  updateComputedTotals() {
    // compute totalStock from active batches
    const total = this.inventoryControls.controls.reduce((sum, g) => {
      const status = g.get('status')?.value;
      const qty = Number(g.get('quantity')?.value || 0);
      return sum + (status === 'active' ? qty : 0);
    }, 0);
    // if multiple inventory enabled, set totalStock readonly to computed value
    if (this.form.get('isMultipleInventory')?.value) {
      this.form.get('totalStock')?.setValue(total, { emitEvent: false });
      // set selling price to active batch price (read-only in template)
      this.form.get('sellingPrice')?.setValue(this.activeUnitPrice, { emitEvent: false });
      this.form.get('totalStock')?.disable({ emitEvent: false });
      this.form.get('sellingPrice')?.disable({ emitEvent: false });
    } else {
      // allow manual editing
      this.form.get('totalStock')?.enable({ emitEvent: false });
      this.form.get('sellingPrice')?.enable({ emitEvent: false });
    }
  }

  onImageButtonClick() {
    const el = document.querySelector<HTMLInputElement>('input[type=file]');
    el?.click();
  }

  async onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    try {
      const compressed = await this.compressImage(file, 1024 * 1024); // max 1MB
      this.imageFile = compressed;
      this.imagePreviewUrl = URL.createObjectURL(compressed);
    } catch (err) {
      this.showConfirmationDialog({
        title: 'Image Upload Error',
        message: 'Image too large or compression failed. Please upload a smaller image.',
        confirmText: 'OK',
        type: 'warning'
      });
    }
  }

  async compressImage(file: File, maxBytes: number): Promise<File> {
    // simple canvas-based resize & compress
    const img = await this.loadImage(URL.createObjectURL(file));
    const targetInches = 2; // approx 2x2 inch
    const dpi = 96; // screen DPI assumption
    const targetPx = Math.round(targetInches * dpi);

    const canvas = document.createElement('canvas');
    canvas.width = targetPx;
    canvas.height = targetPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    // draw centered and cover
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // try quality ramps
    for (let q = 0.9; q >= 0.4; q -= 0.1) {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q));
      if (!blob) continue;
      if (blob.size <= maxBytes) {
        return new File([blob], file.name, { type: 'image/jpeg' });
      }
    }

    // final attempt: smaller canvas
    canvas.width = Math.round(targetPx / 1.5);
    canvas.height = Math.round(targetPx / 1.5);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.7));
    if (!blob) throw new Error('Compression failed');
    if (blob.size > maxBytes) throw new Error('Too large');
    return new File([blob], file.name, { type: 'image/jpeg' });
  }

  loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  async uploadImageIfNeeded(): Promise<string | null> {
    if (!this.imageFile) return this.form.get('imageUrl')?.value || null;
    const storageRef = ref(this.storage, `products/${Date.now()}_${this.imageFile.name}`);
    const snap = await uploadBytes(storageRef, this.imageFile);
    const url = await getDownloadURL(snap.ref);
    return url;
  }

  async save() {
    if (this.form.invalid) return;
    this.isSaving = true;
    try {
      const imageUrl = await this.uploadImageIfNeeded();
      const payload: Product = {
        productName: this.form.get('productName')?.value,
        skuId: this.form.get('skuId')?.value,
        category: this.form.get('category')?.value,
        isMultipleInventory: !!this.form.get('isMultipleInventory')?.value,
        sellingPrice: Number(this.form.get('sellingPrice')?.value || 0),
        imageUrl: imageUrl || this.form.get('imageUrl')?.value,
        inventory: this.inventoryControls.controls.map((g) => ({
          batchId: g.get('batchId')?.value,
          quantity: Number(g.get('quantity')?.value || 0),
          unitPrice: Number(g.get('unitPrice')?.value || 0),
          receivedAt: new Date(g.get('receivedAt')?.value).toISOString(),
          status: g.get('status')?.value,
        })),
        totalStock: this.totalStock,
      };

      // persist to Firestore - for now add to collection 'products'
      const productsCol = collection(db, 'products');
      await addDoc(productsCol, payload as any);

      this.isSaving = false;
      this.close();
    } catch (err) {
      console.error(err);
      this.showConfirmationDialog({
        title: 'Save Error',
        message: 'Failed to save product. Please try again.',
        confirmText: 'OK',
        type: 'danger'
      });
      this.isSaving = false;
    }
  }

  close() {
    // modal must only close via X; provide programmatic close hook
    // consumers should remove the component from DOM when they want to close
    const evt = new CustomEvent('product-manager:close', { bubbles: true });
    window.dispatchEvent(evt);
  }
}
