/**
 * EXAMPLE: Price and Quantity Tracking Usage
 * 
 * This file demonstrates how to use the new price and quantity tracking features
 * in the ProductService.
 */

import { ProductService } from '../services/product.service';

export class ProductTrackingExamples {
  constructor(private productService: ProductService) {}

  /**
   * EXAMPLE 1: Simple Price Update
   * Update the main selling price of a product
   */
  async exampleSimplePriceUpdate() {
    const productId = 'sticky-notes-123';
    
    await this.productService.updateProductPrice(
      productId,
      2.99,  // New price
      'Market adjustment - competitor pricing'
    );
    
    console.log('✅ Price updated to ₱2.99');
    console.log('📊 History:', this.productService.getPriceHistory(productId));
  }

  /**
   * EXAMPLE 2: Update Batch Price
   * Update the price for a specific inventory batch
   */
  async exampleBatchPriceUpdate() {
    const productId = 'sticky-notes-123';
    const batchId = '250826-09';
    
    await this.productService.updateProductPrice(
      productId,
      2.25,  // New price for this batch
      'Supplier cost increase',
      batchId  // Specify batch
    );
    
    console.log(`✅ Batch ${batchId} price updated to ₱2.25`);
  }

  /**
   * EXAMPLE 3: Manual Quantity Adjustment
   * Manually adjust quantity for damage, loss, etc.
   */
  async exampleDamageAdjustment() {
    const productId = 'sticky-notes-123';
    const batchId = '250826-09';
    
    // Current quantity is 20, reducing to 15 due to damage
    await this.productService.adjustBatchQuantity(
      productId,
      batchId,
      15,  // New quantity
      'damage',  // Adjustment type
      'Water damage during storage',
      '5 units damaged and discarded'
    );
    
    console.log('✅ Quantity adjusted for damage');
    console.log('📊 Adjustments:', this.productService.getQuantityAdjustments(productId));
  }

  /**
   * EXAMPLE 4: Split Batch (Most Common Use Case)
   * Move units from one batch to a new batch with a different price
   * 
   * Scenario: "Update Sticky Notes: reduce batch 250826-09 to 20 units,
   *            move 40 units to new batch at ₱2.25"
   */
  async exampleSplitBatch() {
    const productId = 'sticky-notes-123';
    const sourceBatchId = '250826-09';
    
    await this.productService.splitBatch(
      productId,
      sourceBatchId,
      40,  // Move 40 units
      2.25,  // New price for new batch
      'Reallocated 40 units to new batch at updated price'
    );
    
    console.log('✅ Batch split successfully');
    console.log('Result:');
    console.log('- Original batch 250826-09: 20 units at ₱1.75');
    console.log('- New batch created: 40 units at ₱2.25');
    console.log('- Total stock: 60 units');
    
  const product = this.productService.getProduct(productId);
  console.log('📦 Inventory:', product?.inventory);
  console.log('📊 Price History:', product?.priceHistory);
  }

  /**
   * EXAMPLE 5: Restock Adjustment
   * Add more units to an existing batch
   */
  async exampleRestockAdjustment() {
    const productId = 'sticky-notes-123';
    const batchId = '251015-01';
    
    // Increase from 40 to 50 units
    await this.productService.adjustBatchQuantity(
      productId,
      batchId,
      50,  // New quantity
      'restock',
      'Additional inventory received from supplier',
      'Same batch, extended delivery'
    );
    
    console.log('✅ Batch restocked - increased by 10 units');
  }

  /**
   * EXAMPLE 6: Return Adjustment
   * Customer returned items
   */
  async exampleReturnAdjustment() {
    const productId = 'sticky-notes-123';
    const batchId = '251015-01';
    
    // Increase quantity due to customer return
    await this.productService.adjustBatchQuantity(
      productId,
      batchId,
      45,  // New quantity (increased from 40)
      'return',
      'Customer return - unopened package',
      'Return processed on 2025-10-16'
    );
    
    console.log('✅ Return processed - quantity increased');
  }

  /**
   * EXAMPLE 7: View Complete History
   * Get full audit trail for a product
   */
  async exampleViewHistory() {
    const productId = 'sticky-notes-123';
    
    const product = this.productService.getProduct(productId);
    
    console.log('=== PRODUCT AUDIT TRAIL ===');
    console.log('\n📦 Current Inventory:');
    (product?.inventory ?? []).forEach(batch => {
      console.log(`  Batch ${batch.batchId}:`);
      console.log(`    Quantity: ${batch.quantity}`);
      console.log(`    Price: ₱${batch.unitPrice}`);
      console.log(`    Status: ${batch.status}`);
    });
    
    console.log('\n💰 Price History:');
    const priceHistory = this.productService.getPriceHistory(productId);
    priceHistory.forEach(change => {
      console.log(`  ${change.changedAt.toISOString()}`);
      console.log(`    ₱${change.oldPrice} → ₱${change.newPrice} (${change.changeType})`);
      console.log(`    Change: ${change.changeAmount > 0 ? '+' : ''}₱${change.changeAmount} (${change.changePercentage.toFixed(2)}%)`);
      console.log(`    By: ${change.changedByName}`);
      console.log(`    Reason: ${change.reason}`);
      if (change.batchId) console.log(`    Batch: ${change.batchId}`);
    });
    
    console.log('\n📊 Quantity Adjustments:');
    const adjustments = this.productService.getQuantityAdjustments(productId);
    adjustments.forEach(adj => {
      console.log(`  ${adj.adjustedAt.toISOString()}`);
      console.log(`    Batch ${adj.batchId}: ${adj.oldQuantity} → ${adj.newQuantity}`);
      console.log(`    Type: ${adj.adjustmentType}`);
      console.log(`    By: ${adj.adjustedByName}`);
      console.log(`    Reason: ${adj.reason}`);
      if (adj.notes) console.log(`    Notes: ${adj.notes}`);
    });
  }

  /**
   * EXAMPLE 8: AI Agent Command Handler
   * How an AI agent would process natural language commands
   */
  async exampleAICommandHandler(command: string) {
    // Parse: "Update Sticky Notes: reduce batch 250826-09 to 20 units, move 40 units to new batch at ₱2.25"
    
    const productMatch = command.match(/Update (.+?):/);
    const batchMatch = command.match(/batch ([^\s]+)/);
    const reduceToMatch = command.match(/to (\d+) units/);
    const moveMatch = command.match(/move (\d+) units/);
    const priceMatch = command.match(/at ₱([\d.]+)/);
    
    if (productMatch && batchMatch && moveMatch && priceMatch) {
      const productName = productMatch[1];
      const batchId = batchMatch[1];
      const quantityToMove = parseInt(moveMatch[1]);
      const newPrice = parseFloat(priceMatch[1]);
      
      // Find product by name
      const products = this.productService.searchProducts(productName);
      if (products.length > 0) {
        const product = products[0];
        
        await this.productService.splitBatch(
          product.id!,
          batchId,
          quantityToMove,
          newPrice,
          'AI Agent: ' + command
        );
        
        console.log('✅ AI Command executed successfully');
        console.log(`Product: ${productName}`);
        console.log(`Moved: ${quantityToMove} units`);
        console.log(`New Price: ₱${newPrice}`);
      }
    }
  }
}

/**
 * USAGE IN COMPONENT:
 * 
 * export class ProductManagementComponent {
 *   constructor(private productService: ProductService) {}
 * 
 *   async splitBatchExample() {
 *     try {
 *       await this.productService.splitBatch(
 *         this.selectedProduct.id,
 *         '250826-09',
 *         40,
 *         2.25,
 *         'User requested price update'
 *       );
 *       
 *       this.toastService.success('Batch split successfully!');
 *       await this.loadProducts();
 *     } catch (error) {
 *       this.toastService.error('Failed to split batch: ' + error.message);
 *     }
 *   }
 * }
 */
