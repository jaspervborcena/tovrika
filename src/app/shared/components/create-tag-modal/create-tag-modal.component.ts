import { Component, EventEmitter, Input, Output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagsService, ProductTag } from '../../../services/tags.service';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-create-tag-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationDialogComponent],
  template: `
    <div class="modal-overlay" (click)="onCancel()">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Product Tags Management</h2>
          <button class="close-btn" (click)="onCancel()">×</button>
        </div>

        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button 
            class="tab-button"
            [class.active]="activeTab() === 'list'"
            (click)="activeTab.set('list')">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="tab-icon">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Tags List
          </button>
          <button 
            class="tab-button"
            [class.active]="activeTab() === 'create'"
            (click)="activeTab.set('create')">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="tab-icon">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            {{ editMode() ? 'Edit Tag' : 'Create Tag' }}
          </button>
        </div>

        <!-- Tags List Tab -->
        <div class="modal-body" *ngIf="activeTab() === 'list'">
          <div *ngIf="tagGroups().length > 0" class="tags-list">
            <div *ngFor="let group of tagGroups()" class="tag-group-section">
              <div class="tag-group-header">
                <span>{{ group }}</span>
                <button 
                  class="add-item-btn" 
                  (click)="addItemToGroup(group)"
                  title="Add item to this group">
                  +
                </button>
              </div>
              <div class="tag-items">
                <div *ngFor="let tag of getTagsByGroup(group)" 
                     class="tag-item"
                     [class.inactive]="!tag.isActive">
                  <div class="tag-info">
                    <span class="tag-label">{{ tag.label }}</span>
                    <span class="tag-value">{{ tag.value }}</span>
                    <span *ngIf="!tag.isActive" class="tag-status">Inactive</span>
                  </div>
                  <div class="tag-actions">
                    <button 
                      class="action-btn edit-btn" 
                      (click)="editTag(tag)"
                      title="Edit tag">
                      ✏️
                    </button>
                    <button 
                      class="action-btn delete-btn" 
                      (click)="deleteTagConfirm(tag)"
                      title="Delete tag">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="tagGroups().length === 0" class="empty-state">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="empty-icon">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
            <h3>No tags created yet</h3>
            <p>Switch to "Create Tag" tab to add your first tag</p>
          </div>
        </div>

        <!-- Create/Edit Tag Tab -->
        <div class="modal-body" *ngIf="activeTab() === 'create'">
          <div class="form-group">
            <label class="form-label">Group *</label>
            <input 
              type="text" 
              class="form-input"
              [(ngModel)]="group"
              placeholder="e.g., size, temperature, flavor"
              [disabled]="editMode()"
              (input)="updateTagId()">
            <span class="form-hint">Category of the tag (size, color, temperature, etc.)</span>
          </div>

          <div class="form-group">
            <label class="form-label">Label *</label>
            <input 
              type="text" 
              class="form-input"
              [(ngModel)]="label"
              placeholder="e.g., Large, Hot, Sweet"
              (input)="updateTagId()">
            <span class="form-hint">Display name for the tag</span>
          </div>

          <div class="form-group">
            <label class="form-label">Value *</label>
            <input 
              type="text" 
              class="form-input"
              [(ngModel)]="value"
              placeholder="e.g., large, hot, sweet"
              [disabled]="editMode()"
              (input)="updateTagId()">
            <span class="form-hint">Internal value (lowercase, no spaces)</span>
          </div>

          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                [(ngModel)]="isActive">
              <span>Active</span>
            </label>
            <span class="form-hint">Only active tags will be available for selection</span>
          </div>

          <div *ngIf="errorMessage()" class="error-message">
            {{ errorMessage() }}
          </div>
        </div>

        <div class="modal-footer" *ngIf="activeTab() === 'create'">
          <button class="btn-secondary" (click)="onCancel()">Cancel</button>
          <button 
            class="btn-primary" 
            (click)="onSave()"
            [disabled]="!isValid() || isSaving()">
            {{ isSaving() ? 'Saving...' : (editMode() ? 'Update' : 'Create') }}
          </button>
        </div>

        <div class="modal-footer" *ngIf="activeTab() === 'list'">
          <button class="btn-secondary" (click)="onCancel()">Close</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <app-confirmation-dialog 
      *ngIf="showDeleteConfirmation() && deleteConfirmationData()" 
      [dialogData]="deleteConfirmationData()!" 
      (confirmed)="onDeleteConfirmed()" 
      (cancelled)="closeDeleteConfirmation()">
    </app-confirmation-dialog>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(2px);
      padding: 1rem;
    }

    .modal-container {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #e5e7eb;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px 12px 0 0;
    }

    .modal-header h2 {
      font-size: 1.25rem;
      font-weight: 600;
      color: white;
      margin: 0;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 1.5rem;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      line-height: 1;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .modal-body {
      padding: 2rem;
      overflow-y: auto;
      flex: 1;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    .form-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #6b7280;
      font-size: 0.875rem;
    }

    .form-input {
      width: 100%;
      max-width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #1f2937;
      background: white;
      transition: all 0.2s ease;
      box-sizing: border-box;
      outline: none;
    }

    .form-input:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-input:disabled {
      background: #f9fafb;
      color: #6b7280;
      cursor: not-allowed;
    }

    .form-hint {
      display: block;
      font-size: 0.75rem;
      color: #9ca3af;
      margin-top: 0.375rem;
    }

    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 0.875rem;
      color: #374151;
      font-weight: 500;
    }

    .checkbox-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .error-message {
      margin-top: 0.5rem;
      padding: 12px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      color: #dc2626;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      padding: 1.5rem 2rem;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
      border-radius: 0 0 12px 12px;
    }

    .btn-primary, .btn-secondary {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #e2e8f0;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
      transform: translateY(-1px);
    }

    /* Tab Navigation Styles */
    .tab-navigation {
      display: flex;
      border-bottom: 2px solid #e5e7eb;
      background: #f9fafb;
    }

    .tab-button {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1rem;
      border: none;
      background: transparent;
      color: #6b7280;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border-bottom: 3px solid transparent;
    }

    .tab-button:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .tab-button.active {
      color: #667eea;
      border-bottom-color: #667eea;
      background: white;
    }

    .tab-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    /* Tags List Styles */
    .tags-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .tag-group-section {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }

    .tag-group-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 0.75rem 1rem;
      font-weight: 600;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .add-item-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 1.5rem;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      line-height: 1;
      font-weight: 300;
    }

    .add-item-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .tag-items {
      background: white;
    }

    .tag-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #f3f4f6;
      gap: 1rem;
    }

    .tag-item:last-child {
      border-bottom: none;
    }

    .tag-item.inactive {
      opacity: 0.6;
      background: #f9fafb;
    }

    .tag-info {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
    }

    .tag-label {
      flex: 1;
      font-weight: 600;
      color: #1f2937;
      font-size: 0.875rem;
    }

    .tag-value {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.75rem;
      color: #6b7280;
      background: #f3f4f6;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .tag-status {
      font-size: 0.75rem;
      color: #dc2626;
      font-weight: 500;
    }

    .tag-actions {
      display: flex;
      gap: 0.5rem;
    }

    .action-btn {
      padding: 0.375rem;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 0.375rem;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 1rem;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .action-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .edit-btn:hover {
      background: #eff6ff;
      border-color: #3b82f6;
    }

    .delete-btn:hover {
      background: #fef2f2;
      border-color: #ef4444;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 3rem 2rem;
      color: #9ca3af;
    }

    .empty-icon {
      width: 3rem;
      height: 3rem;
      margin: 0 auto 1rem;
      opacity: 0.5;
    }

    .empty-state h3 {
      font-size: 1.125rem;
      font-weight: 600;
      color: #6b7280;
      margin: 0 0 0.5rem 0;
    }

    .empty-state p {
      font-size: 0.875rem;
      color: #9ca3af;
      margin: 0;
    }
  `]
})
export class CreateTagModalComponent {
  @Input() existingTag?: ProductTag;
  @Input() storeId!: string;
  @Output() saved = new EventEmitter<ProductTag>();
  @Output() cancelled = new EventEmitter<void>();

  private tagsService = inject(TagsService);

  protected group = '';
  protected label = '';
  protected value = '';
  protected isActive = true;
  protected errorMessage = signal<string>('');
  protected isSaving = signal<boolean>(false);
  protected editMode = signal<boolean>(false);
  protected generatedTagId = signal<string>('');
  protected activeTab = signal<'list' | 'create'>('list');
  protected allTags = signal<ProductTag[]>([]);
  protected tagGroups = signal<string[]>([]);
  
  // Delete confirmation dialog
  protected showDeleteConfirmation = signal<boolean>(false);
  protected deleteConfirmationData = signal<ConfirmationDialogData | null>(null);
  private tagToDelete: ProductTag | null = null;

  async ngOnInit() {
    if (this.existingTag) {
      this.editMode.set(true);
      this.group = this.existingTag.group;
      this.label = this.existingTag.label;
      this.value = this.existingTag.value;
      this.isActive = this.existingTag.isActive;
      this.updateTagId();
      this.activeTab.set('create');
    }
    
    // Load existing tags
    await this.loadTags();
  }

  private async loadTags() {
    try {
      // Load all tags including inactive ones for the list view
      const tags = await this.tagsService.getTagsByStore(this.storeId, true);
      this.allTags.set(tags);
      const groups = await this.tagsService.getAllTagGroups(this.storeId, true);
      this.tagGroups.set(groups);
      console.log('Loaded tags:', tags);
      console.log('Tag groups:', groups);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }

  protected getTagsByGroup(group: string): ProductTag[] {
    return this.allTags().filter(t => t.group === group);
  }

  protected addItemToGroup(group: string) {
    // Set the group field and switch to create tab
    this.group = group;
    this.label = '';
    this.value = '';
    this.isActive = true;
    this.editMode.set(false);
    this.activeTab.set('create');
  }

  protected editTag(tag: ProductTag) {
    // Populate form with tag data
    this.editMode.set(true);
    this.group = tag.group;
    this.label = tag.label;
    this.value = tag.value;
    this.isActive = tag.isActive;
    this.existingTag = tag;
    this.updateTagId();
    this.activeTab.set('create');
  }

  protected async deleteTagConfirm(tag: ProductTag) {
    if (!tag.id) return;
    
    this.tagToDelete = tag;
    this.deleteConfirmationData.set({
      title: 'Delete Tag',
      message: `Are you sure you want to delete the tag "${tag.label}"? This action cannot be undone.`,
      confirmText: 'Yes, Delete',
      cancelText: 'No, Cancel',
      type: 'danger'
    });
    this.showDeleteConfirmation.set(true);
  }

  protected async onDeleteConfirmed() {
    if (!this.tagToDelete?.id) return;

    try {
      await this.tagsService.deleteTag(this.tagToDelete.id);
      await this.loadTags();
      // Emit saved event to refresh parent component
      this.saved.emit(this.tagToDelete);
      this.closeDeleteConfirmation();
    } catch (error: any) {
      console.error('Error deleting tag:', error);
      this.errorMessage.set('Failed to delete tag: ' + (error.message || 'Unknown error'));
      this.closeDeleteConfirmation();
    }
  }

  protected closeDeleteConfirmation() {
    this.showDeleteConfirmation.set(false);
    this.deleteConfirmationData.set(null);
    this.tagToDelete = null;
  }

  protected updateTagId() {
    if (this.group && this.value) {
      const tagId = this.tagsService.generateTagId(this.group, this.value);
      this.generatedTagId.set(tagId);
    } else {
      this.generatedTagId.set('');
    }
  }

  protected isValid(): boolean {
    return !!(this.group.trim() && this.label.trim() && this.value.trim());
  }

  protected async onSave() {
    if (!this.isValid() || this.isSaving()) return;

    this.isSaving.set(true);
    this.errorMessage.set('');

    try {
      const tagData: Omit<ProductTag, 'id' | 'createdAt' | 'createdBy'> = {
        tagId: this.generatedTagId(),
        group: this.group.trim(),
        label: this.label.trim(),
        value: this.value.trim().toLowerCase().replace(/\s+/g, '_'),
        isActive: this.isActive,
        storeId: this.storeId
      };

      if (this.editMode() && this.existingTag?.id) {
        await this.tagsService.updateTag(this.existingTag.id, {
          label: tagData.label,
          isActive: tagData.isActive
        });
        this.saved.emit({ ...this.existingTag, ...tagData } as ProductTag);
      } else {
        const id = await this.tagsService.createTag(tagData);
        this.saved.emit({ id, ...tagData } as ProductTag);
      }

      // Reload tags and switch to list tab
      await this.loadTags();
      this.activeTab.set('list');
      
      // Reset form
      this.group = '';
      this.label = '';
      this.value = '';
      this.isActive = true;
      this.editMode.set(false);
      this.existingTag = undefined;
      this.generatedTagId.set('');
      this.isSaving.set(false);
    } catch (error: any) {
      console.error('Error saving tag:', error);
      this.errorMessage.set(error.message || 'Failed to save tag');
      this.isSaving.set(false);
    }
  }

  protected onCancel() {
    this.cancelled.emit();
  }
}
