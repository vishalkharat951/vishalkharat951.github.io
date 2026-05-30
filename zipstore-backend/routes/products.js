const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const categoryController = require('../controllers/categoryController');
const { authenticate, isAdmin } = require('../middleware/auth');

router.get('/products', productController.getProducts);
router.get('/products/:id', productController.getProduct);
router.post('/products', authenticate, isAdmin, productController.createProduct);
router.put('/products/:id', authenticate, isAdmin, productController.updateProduct);
router.delete('/products/:id', authenticate, isAdmin, productController.deleteProduct);

router.post('/categories', authenticate, isAdmin, categoryController.createCategory);

module.exports = router;
