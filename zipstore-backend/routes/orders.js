const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const paymentController = require('../controllers/paymentController');
const { authenticate, isAdmin } = require('../middleware/auth');

router.post('/orders', authenticate, orderController.createOrder);
router.post('/payments/checkout-mock', authenticate, paymentController.checkoutMock);
router.get('/admin/orders', authenticate, isAdmin, orderController.getAdminOrders);
router.patch('/admin/orders/:id', authenticate, isAdmin, orderController.updateOrderStatus);

module.exports = router;
