const { getFirestore } = require('../config/firebase');
const { logger } = require('../utils/logger');

class User {
  constructor(data) {
    this.uid = data.uid;
    this.email = data.email;
    this.displayName = data.displayName;
    this.photoURL = data.photoURL;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.subscription = data.subscription || null;
    this.stripeCustomerId = data.stripeCustomerId || null;
    this.metadata = data.metadata || {};
  }

  // Create user in Firestore
  static async create(userData) {
    try {
      const db = getFirestore();
      const userRef = db.collection('users').doc(userData.uid);
      
      const user = new User({
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await userRef.set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        subscription: user.subscription,
        stripeCustomerId: user.stripeCustomerId,
        metadata: user.metadata
      });

      logger.info(`✅ Created user: ${user.uid}`);
      return user;
    } catch (error) {
      logger.error('❌ Failed to create user:', error);
      throw error;
    }
  }

  // Get user by UID
  static async getByUid(uid) {
    try {
      const db = getFirestore();
      const userDoc = await db.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        return null;
      }

      const userData = userDoc.data();
      return new User(userData);
    } catch (error) {
      logger.error('❌ Failed to get user by UID:', error);
      throw error;
    }
  }

  // Get user by email
  static async getByEmail(email) {
    try {
      const db = getFirestore();
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', email).limit(1).get();
      
      if (snapshot.empty) {
        return null;
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      return new User(userData);
    } catch (error) {
      logger.error('❌ Failed to get user by email:', error);
      throw error;
    }
  }

  // Update user
  async update(updateData) {
    try {
      const db = getFirestore();
      const userRef = db.collection('users').doc(this.uid);
      
      const updateFields = {
        ...updateData,
        updatedAt: new Date()
      };

      await userRef.update(updateFields);
      
      // Update local instance
      Object.assign(this, updateFields);
      
      logger.info(`✅ Updated user: ${this.uid}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to update user:', error);
      throw error;
    }
  }

  // Update subscription
  async updateSubscription(subscriptionData) {
    try {
      const db = getFirestore();
      const userRef = db.collection('users').doc(this.uid);
      
      const subscription = {
        ...subscriptionData,
        updatedAt: new Date()
      };

      await userRef.update({
        subscription: subscription,
        updatedAt: new Date()
      });
      
      this.subscription = subscription;
      this.updatedAt = new Date();
      
      logger.info(`✅ Updated subscription for user: ${this.uid}`);
      return this;
    } catch (error) {
      logger.error('❌ Failed to update subscription:', error);
      throw error;
    }
  }

  // Set Stripe customer ID
  async setStripeCustomerId(customerId) {
    try {
      await this.update({ stripeCustomerId: customerId });
      logger.info(`✅ Set Stripe customer ID for user: ${this.uid}`);
    } catch (error) {
      logger.error('❌ Failed to set Stripe customer ID:', error);
      throw error;
    }
  }

  // Check if user has active subscription
  hasActiveSubscription() {
    if (!this.subscription) {
      return false;
    }

    const now = new Date();
    const expiryDate = new Date(this.subscription.expiresAt);
    
    return this.subscription.status === 'active' && expiryDate > now;
  }

  // Get subscription status
  getSubscriptionStatus() {
    if (!this.subscription) {
      return 'none';
    }

    const now = new Date();
    const expiryDate = new Date(this.subscription.expiresAt);
    
    if (this.subscription.status === 'active' && expiryDate > now) {
      return 'active';
    } else if (this.subscription.status === 'cancelled' && expiryDate > now) {
      return 'cancelled';
    } else {
      return 'expired';
    }
  }

  // Get days until expiry
  getDaysUntilExpiry() {
    if (!this.subscription) {
      return 0;
    }

    const now = new Date();
    const expiryDate = new Date(this.subscription.expiresAt);
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  // Convert to JSON
  toJSON() {
    return {
      uid: this.uid,
      email: this.email,
      displayName: this.displayName,
      photoURL: this.photoURL,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      subscription: this.subscription,
      stripeCustomerId: this.stripeCustomerId,
      metadata: this.metadata
    };
  }

  // Convert to public JSON (without sensitive data)
  toPublicJSON() {
    return {
      uid: this.uid,
      email: this.email,
      displayName: this.displayName,
      photoURL: this.photoURL,
      subscription: this.subscription,
      hasActiveSubscription: this.hasActiveSubscription(),
      subscriptionStatus: this.getSubscriptionStatus(),
      daysUntilExpiry: this.getDaysUntilExpiry()
    };
  }
}

module.exports = User;
