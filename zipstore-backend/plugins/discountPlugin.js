module.exports = function register(app) {
  app.use('/api/orders', (req, res, next) => {
    if (req.method !== 'POST') return next();

    const originalJson = res.json.bind(res);
    const originalBody = req.body;

    const originalNext = next;

    const wrappedNext = () => {
      if (req.body && req.body.items) {
        let total = 0;
        for (const item of req.body.items) {
          total += (item.price || 0) * (item.quantity || 1);
        }

        if (total > 100) {
          req._discountedTotal = parseFloat((total * 0.9).toFixed(2));
          console.log(`[DiscountPlugin] 10% discount applied: $${total} -> $${req._discountedTotal}`);
        }
      }
      originalNext();
    };

    wrappedNext();
  });
};
