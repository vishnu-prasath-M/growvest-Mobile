'use strict';

const UpiPayment = require('../models/UpiPayment');
const UpiAlert = require('../models/UpiAlert');
const UpiSyncState = require('../models/UpiSyncState');
const { RULES, fail, round2 } = require('codemode-upi-pay/src/rules');

const toObj = (doc) => (doc ? (typeof doc.toObject === 'function' ? doc.toObject() : JSON.parse(JSON.stringify(doc))) : null);

class MongoStore {
  constructor() {
    this.key = 'default';
  }

  async init() {
    await UpiSyncState.findOneAndUpdate(
      { key: this.key },
      { $setOnInsert: { key: this.key, lastUid: 0, uidValidity: 0 } },
      { upsert: true, new: true }
    );
  }

  // input: { id, amount, ref, expiresAt, orderId, customer, note, metadata, minutes }
  async createPayment(input) {
    const amount = round2(input.amount);
    if (!(amount >= 1) || Math.abs(amount - Number(input.amount)) > 1e-9) {
      fail('BAD_AMOUNT');
    }

    const now = Date.now();
    const nowIso = new Date(now);

    // If orderId is provided, check existing open payments
    if (input.orderId) {
      const open = await UpiPayment.find({
        orderId: input.orderId,
        status: 'pending',
        expiresAt: { $gt: nowIso },
      }).sort({ createdAt: -1 });

      const same = open.find(
        (p) =>
          Math.abs(p.amount - amount) < 0.01 &&
          new Date(p.expiresAt).getTime() > now + 2 * 60e3
      );
      if (same) {
        return toObj(same);
      }

      if (open.length >= RULES.maxOpenPerOrder) {
        fail('TOO_MANY_OPEN');
      }
    }

    // Find all taken amounts in the open time window
    const openPayments = await UpiPayment.find({
      status: 'pending',
      expiresAt: { $gt: new Date(now - RULES.matchAfterMs) },
    }).select('payAmount');

    const recentAlerts = await UpiAlert.find({
      paymentId: null,
      receivedAt: { $gt: new Date(now - RULES.holdAfterAlertMs) },
    }).select('amount');

    const takenSet = new Set([
      ...openPayments.map((p) => round2(p.payAmount)),
      ...recentAlerts.map((a) => round2(a.amount)),
    ]);

    const free = [];
    for (let paise = 1; paise <= 99; paise++) {
      const pay = round2(amount + paise / 100);
      if (!takenSet.has(pay)) {
        free.push(pay);
      }
    }

    if (!free.length) {
      fail('NO_FREE_AMOUNT');
    }

    const chosenPayAmount = free[Math.floor(Math.random() * free.length)];
    const expiresAtDate = new Date(now + input.minutes * 60e3);

    const doc = await UpiPayment.create({
      id: input.id,
      amount,
      payAmount: chosenPayAmount,
      ref: input.ref,
      status: 'pending',
      orderId: input.orderId || null,
      customer: input.customer || null,
      note: input.note || null,
      metadata: input.metadata || {},
      expiresAt: expiresAtDate,
      createdAt: nowIso,
      paidAt: null,
      paidAmount: null,
      utr: null,
      bank: null,
      payer: null,
      matchedBy: null,
      utrTries: 0,
    });

    return toObj(doc);
  }

  async getPayment(id) {
    const doc = await UpiPayment.findOne({ id: String(id) });
    return toObj(doc);
  }

  async listPayments(opts = {}) {
    const query = {};
    if (opts.status) query.status = opts.status;
    if (opts.orderId) query.orderId = opts.orderId;

    const docs = await UpiPayment.find(query)
      .sort({ createdAt: -1 })
      .limit(opts.limit || 50);

    return docs.map(toObj);
  }

  // Save genuine alerts (repeats ignored) and match them. Returns the payments that got settled.
  async ingestAlerts(alerts = []) {
    for (const a of alerts) {
      if (!a || !/^\d{12}$/.test(a.utr) || !(Number(a.amount) > 0)) continue;
      const at = Math.min(new Date(a.receivedAt).getTime() || Date.now(), Date.now());

      try {
        await UpiAlert.updateOne(
          { utr: a.utr },
          {
            $setOnInsert: {
              utr: a.utr,
              amount: round2(a.amount),
              bank: a.bank || null,
              payer: a.payer || null,
              ref: a.ref || null,
              receivedAt: new Date(at),
              paymentId: null,
            },
          },
          { upsert: true }
        );
      } catch (err) {
        // duplicate key or mongo error ignored
      }
    }

    return this.matchAlerts();
  }

  _inWindow(p, a, afterMs) {
    const t = new Date(a.receivedAt).getTime();
    const createdTime = new Date(p.createdAt).getTime();
    const expiresTime = new Date(p.expiresAt).getTime();
    return t >= createdTime - RULES.matchBeforeMs && t <= expiresTime + afterMs;
  }

  async _settle(paymentDoc, alertDoc, how) {
    if (!paymentDoc || paymentDoc.status !== 'pending' || alertDoc.paymentId) {
      return null;
    }

    const isPaid = alertDoc.amount + 0.001 >= paymentDoc.payAmount;
    const finalStatus = isPaid ? 'paid' : 'underpaid';
    const now = new Date();

    const updatedPayment = await UpiPayment.findOneAndUpdate(
      { id: paymentDoc.id, status: 'pending' },
      {
        $set: {
          status: finalStatus,
          paidAt: now,
          paidAmount: alertDoc.amount,
          utr: alertDoc.utr,
          bank: alertDoc.bank,
          payer: alertDoc.payer,
          matchedBy: how,
        },
      },
      { new: true }
    );

    if (!updatedPayment) {
      return null; // Concurrently settled
    }

    await UpiAlert.updateOne(
      { utr: alertDoc.utr },
      { $set: { paymentId: paymentDoc.id } }
    );

    return toObj(updatedPayment);
  }

  async matchAlerts() {
    const settled = [];
    const openPayments = await UpiPayment.find({ status: 'pending' });
    if (!openPayments.length) return settled;

    const freshAlerts = await UpiAlert.find({
      paymentId: null,
      receivedAt: { $gt: new Date(Date.now() - RULES.lookBackMs) },
    }).sort({ receivedAt: 1 });

    for (const a of freshAlerts) {
      let targetPayment = null;
      let how = 'ref';

      if (a.ref) {
        targetPayment = openPayments.find(
          (p) => p.ref === a.ref && this._inWindow(p, a, RULES.matchAfterMs)
        ) || null;
      }

      if (!targetPayment) {
        const hits = openPayments.filter(
          (p) => Math.abs(p.payAmount - a.amount) < 0.001 && this._inWindow(p, a, RULES.matchAfterMs)
        );
        if (hits.length === 1) {
          targetPayment = hits[0];
          how = 'amount';
        }
      }

      if (targetPayment) {
        const done = await this._settle(targetPayment, a, how);
        if (done) {
          settled.push(done);
          // Remove settled payment from active memory list
          const idx = openPayments.findIndex((p) => p.id === targetPayment.id);
          if (idx !== -1) openPayments.splice(idx, 1);
        }
      }
    }

    return settled;
  }

  // Returns { result: 'paid' | 'underpaid' | 'not_found' | 'used', payment, settled }
  async claimUtr(id, utr) {
    const p = await UpiPayment.findOne({ id: String(id) });
    if (!p) fail('NOT_FOUND');

    if (p.status !== 'pending') {
      return { result: p.status, payment: toObj(p), settled: false };
    }

    if (p.utrTries >= RULES.maxUtrTries) {
      fail('TOO_MANY_TRIES');
    }

    p.utrTries += 1;
    await p.save();

    const a = await UpiAlert.findOne({ utr: String(utr).trim() });
    if (!a || !this._inWindow(p, a, RULES.utrAfterMs)) {
      return { result: 'not_found', payment: toObj(p), settled: false };
    }

    if (a.paymentId) {
      return { result: 'used', payment: toObj(p), settled: false };
    }

    const done = await this._settle(p, a, 'utr');
    if (!done) {
      const refreshed = await UpiPayment.findOne({ id: String(id) });
      return { result: refreshed?.status || 'pending', payment: toObj(refreshed), settled: false };
    }

    return { result: done.status, payment: done, settled: true };
  }

  // Inbox reader throttle
  async claimSync(minSeconds = 10) {
    const now = Date.now();
    let state = await UpiSyncState.findOne({ key: this.key });
    if (!state) {
      state = await UpiSyncState.create({ key: this.key, lastUid: 0, uidValidity: 0 });
    }

    if (state.lastRun && now - new Date(state.lastRun).getTime() < minSeconds * 1000) {
      return null;
    }

    state.lastRun = new Date(now);
    await state.save();

    return { lastUid: state.lastUid || 0, uidValidity: state.uidValidity || 0 };
  }

  async finishSync(r = {}) {
    const state = await UpiSyncState.findOne({ key: this.key });
    if (!state) return;

    if (r.lastUid != null) {
      state.lastUid = r.uidValidity === state.uidValidity ? Math.max(state.lastUid || 0, r.lastUid) : r.lastUid;
      state.uidValidity = r.uidValidity;
    }

    if (!r.error) {
      state.lastOk = new Date();
      state.lastError = null;
    } else {
      state.lastError = String(r.error).slice(0, 300);
    }

    await state.save();
  }

  async syncStatus() {
    const state = await UpiSyncState.findOne({ key: this.key });
    return {
      lastRun: state?.lastRun ? state.lastRun.toISOString() : null,
      lastOk: state?.lastOk ? state.lastOk.toISOString() : null,
      lastError: state?.lastError || null,
    };
  }

  async unmatchedAlerts(limit = 50) {
    const alerts = await UpiAlert.find({ paymentId: null })
      .sort({ receivedAt: -1 })
      .limit(limit);
    return alerts.map(toObj);
  }
}

module.exports = MongoStore;
