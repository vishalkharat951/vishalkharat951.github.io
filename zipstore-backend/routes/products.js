const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const categoryController = require('../controllers/categoryController');
const { authenticate } = require('../middleware/auth');

router.get('/products', productController.getProducts);
router.get('/products/:id', productController.getProduct);
router.post('/products', authenticate, productController.createProduct);
router.put('/products/:id', authenticate, productController.updateProduct);
router.delete('/products/:id', authenticate, productController.deleteProduct);

router.get('/categories', categoryController.getCategories);
router.get('/categories/:id', categoryController.getCategory);
router.post('/categories', authenticate, categoryController.createCategory);
router.put('/categories/:id', authenticate, categoryController.updateCategory);
router.delete('/categories/:id', authenticate, categoryController.deleteCategory);

module.exports = router;
