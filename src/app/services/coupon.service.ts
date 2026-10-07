import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  increment,
  Timestamp,
} from '@angular/fire/firestore';
import { SubscriptionService } from './subscription.service';
import { AuthService } from './auth.service';

export interface CouponDoc {
  id: string;
  couponCode: string;
  status: string;
  validUntil: Timestamp;
  maxRedemptions: number;
  redemptionsUsed: number;
  durationDays: number;
  description: string;
  appliesTo: {
    plan: string;
    product: string;
    discountType?: 'fixed' | 'percentage';
    discountValue?: number;
  };
  restrictions: {
    newUsersOnly?: boolean;
    region?: string;
  };
}

export interface ApplyCouponResult {
  success: boolean;
  subscriptionId?: string;
  message: string;
  coupon?: CouponDoc;
}

@Injectable({ providedIn: 'root' })
export class CouponService {
  private readonly firestore = inject(Firestore);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly auth = inject(AuthService);

  /**
   * Look up a coupon by couponCode in the `coupons` collection.
   */
  async getCoupon(couponCode: string): Promise<CouponDoc | null> {
    const q = query(
      collection(this.firestore, 'coupons'),
      where('couponCode', '==', couponCode.trim().toUpperCase())
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<CouponDoc, 'id'>) };
  }

  /**
   * Normalize Firestore Timestamp / Date / ISO strings into a JavaScript Date.
   */
  private toDate(value: unknown): Date | null {
    if (!value) return null;

    if (value instanceof Date) return value;

    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof value === 'object') {
      const candidate = value as any;
      if (typeof candidate.toDate === 'function') {
        const date = candidate.toDate();
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
      }
      if (typeof candidate.seconds === 'number') {
        const date = new Date(candidate.seconds * 1000);
        return Number.isNaN(date.getTime()) ? null : date;
      }
    }

    return null;
  }

  /**
   * Validate a coupon. Returns an error message string if invalid, or null if valid.
   */
  validateCoupon(coupon: CouponDoc, region: string, isNewUser: boolean): string | null {
    if (coupon.status !== 'active') return 'Coupon is not active.';

    const now = new Date();
    const validUntil = this.toDate((coupon as any).validUntil ?? (coupon as any).validUntilDate ?? (coupon as any).expiresAt);
    if (!validUntil) return 'Coupon expiry date is missing.';
    if (now.getTime() > validUntil.getTime()) return 'Coupon has expired.';

    if (coupon.redemptionsUsed >= coupon.maxRedemptions)
      return 'Coupon has reached its maximum redemptions.';

    const newUsersOnly = (coupon as any).restrictions?.newUsersOnly ?? (coupon as any).newUsersOnly ?? false;
    if (newUsersOnly && !isNewUser) {
      return 'This coupon is only valid for new users.';
    }

    const regionRule = (coupon as any).restrictions?.region ?? (coupon as any).region;
    if (regionRule && String(regionRule) !== String(region))
      return `Coupon is only valid in region: ${regionRule}.`;

    return null;
  }

  /**
   * Apply a coupon to create a free subscription (no payment required).
   * - Validates the coupon
   * - Creates a subscription for `durationDays`
   * - Increments `redemptionsUsed` on the coupon
   */
  async applyCouponSubscription(
    couponCode: string,
    companyId: string,
    storeId: string,
    region: string = 'PH',
    isNewUser: boolean = true
  ): Promise<ApplyCouponResult> {
    const user = this.auth.getCurrentUser();
    if (!user?.uid) return { success: false, message: 'Not authenticated.' };

    // 1. Look up coupon
    const coupon = await this.getCoupon(couponCode);
    if (!coupon) return { success: false, message: 'Coupon code not found.' };

    // 2. Validate coupon
    const validationError = this.validateCoupon(coupon, region, isNewUser);
    if (validationError) return { success: false, message: validationError };

    // 3. Create free subscription based on durationDays
    const now = new Date();
    const endDate = new Date(now.getTime() + coupon.durationDays * 24 * 60 * 60 * 1000);

    const subscriptionId = await this.subscriptionService.createSubscription({
      subscriptionId: crypto.randomUUID(),
      companyId,
      storeId,
      uid: user.uid,
      planType: coupon.appliesTo?.plan || 'monthly',
      status: 'active',
      startDate: now,
      endDate,
      isTrial: false,
      promoCode: coupon.couponCode,
      paymentMethod: 'coupon',
      amountPaid: 0,
      currency: 'PHP',
    });

    // 4. Increment redemptionsUsed on the coupon document
    const couponRef = doc(this.firestore, 'coupons', coupon.id);
    await updateDoc(couponRef, {
      redemptionsUsed: increment(1),
      updatedAt: new Date(),
    });

    return {
      success: true,
      subscriptionId,
      message: `Coupon applied! You have a free ${coupon.durationDays}-day subscription. ${coupon.description}`,
      coupon,
    };
  }
}
