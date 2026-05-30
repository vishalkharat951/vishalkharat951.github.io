const Order = require('../models/Order');
const Product = require('../models/Product');

exports.createOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    if (!shippingAddress || !shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zip || !shippingAddress.country) {
      return res.status(400).json({ error: 'Complete shipping address is required' });
    }

    const productIds = items.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products not found' });
    }

    const productMap = {};
    for (const p of products) {
      productMap[p._id.toString()] = p;
    }

    for (const item of items) {
      const product = productMap[item.productId];
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.title}` });
      }
    }

    let totalAmount = 0;
    const orderItems = items.map(item => {
      const product = productMap[item.productId];
      const price = product.price;
      totalAmount += price * item.quantity;
      return { productId: item.productId, quantity: item.quantity, price };
    });

    const order = await Order.create({
      userId: req.user.id,
      items: orderItems,
      totalAmount,
      shippingAddress,
    });

    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity },
      });
    }

    if (req._discountedTotal !== undefined) {
      order.totalAmount = req._discountedTotal;
      await order.save();
    }

    res.status(201).json({ message: 'Order created', order });
  } catch (err) {
    next(err);
  }
};

exports.getAdminOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('userId', 'name email')
      .populate('items.productId', 'title price')
      .sort('-createdAt');
    res.json({ count: orders.length, orders });
  } catch (err) {
    next(err);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus, paymentStatus } = req.body;

    const update = {};
    if (orderStatus) update.orderStatus = orderStatus;
    if (paymentStatus) update.paymentStatus = paymentStatus;

    if (!Object.keys(update).length) {
      return res.status(400).json({ error: 'Provide orderStatus or paymentStatus to update' });
    }

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order updated', order });
  } catch (err) {
    next(err);
  }
};
