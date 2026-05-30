const Order = require('../models/Order');

exports.checkoutMock = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Order is already paid' });
    }

    const mockToken = 'mocked_payment_token_' + Date.now();

    order.paymentStatus = 'paid';
    await order.save();

    res.json({
      message: 'Payment successful (mock)',
      mockToken,
      order: {
        id: order._id,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        totalAmount: order.totalAmount,
      },
    });
  } catch (err) {
    next(err);
  }
};
