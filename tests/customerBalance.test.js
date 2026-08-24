const test = require('node:test');
const assert = require('node:assert/strict');
const { roundMoney } = require('../lib/money');

// Mirrors the totalBalanceDue calc in routes/customers.js's
// POST /customer/deleteCustomer (and the identical logic already used by
// GET /api/customers and models/Customers.js's totalBalanceDue virtual).

function totalBalanceDue(orders) {
  return roundMoney(orders.reduce((sum, o) => sum + (o.balanceDue || 0), 0));
}

test('totalBalanceDue is zero for a customer with no orders', () => {
  assert.equal(totalBalanceDue([]), 0);
});

test('totalBalanceDue is zero when every order is fully paid', () => {
  const orders = [{ balanceDue: 0 }, { balanceDue: 0 }];
  assert.equal(totalBalanceDue(orders), 0);
});

test('totalBalanceDue sums outstanding balances across multiple orders', () => {
  const orders = [{ balanceDue: 100 }, { balanceDue: 50.5 }, { balanceDue: 0 }];
  assert.equal(totalBalanceDue(orders), 150.5);
});

test('totalBalanceDue treats a missing balanceDue field as zero', () => {
  const orders = [{ balanceDue: 25 }, {}];
  assert.equal(totalBalanceDue(orders), 25);
});

test('totalBalanceDue rounds cleanly on fractional cents', () => {
  const orders = [{ balanceDue: 19.995 }, { balanceDue: 0.005 }];
  assert.equal(totalBalanceDue(orders), roundMoney(19.995 + 0.005));
});
